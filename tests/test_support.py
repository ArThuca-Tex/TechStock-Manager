import json
import unittest
from unittest.mock import patch

from app import app
from support import MAX_MESSAGE, RateLimit


class SupportTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        limits = patch("support.limits", RateLimit())
        state = patch("support.provider_state", (0, False))
        limits.start()
        state.start()
        self.addCleanup(limits.stop)
        self.addCleanup(state.stop)
        self.settings = ("test-key", "gemini-3.5-flash-lite")

    def csrf(self):
        with self.client.session_transaction() as session:
            session["csrf"] = "test-csrf"
        return "test-csrf"

    def message(self, text, **fields):
        return self.client.post("/suporte/mensagens", data={
            "csrf_token": self.csrf(), "message": text, **fields,
        })

    def test_guest_page_and_login_link(self):
        support_page = self.client.get("/suporte")
        self.assertEqual(support_page.status_code, 200)
        self.assertIn("Central de suporte", support_page.get_data(as_text=True))
        self.assertIn('href="/suporte"', self.client.get("/login").get_data(as_text=True))
        self.assertEqual(self.client.get("/movimentacoes").status_code, 302)

    @patch("support.provider_settings", return_value=None)
    def test_offline_faqs(self, _):
        self.assertEqual(self.client.get("/suporte/status").json["mode"], "offline")
        for question, phrase in (
            ("Não consigo entrar", "e-mail corporativo"),
            ("Como cadastrar um produto?", "Novo produto"),
            ("Como adicionar uma categoria?", "Adicionar categoria"),
            ("Como cadastro um fornecedor?", "não oferece formulário"),
            ("Como registrar saída de estoque?", "saldo disponível"),
        ):
            answer = self.message(question).json
            self.assertEqual(answer["mode"], "offline")
            self.assertIn(phrase, answer["answer"])

    @patch("support.http.client.HTTPSConnection")
    def test_gemini_success_real_adapter_and_privacy_filter(self, connection):
        response = connection.return_value.getresponse.return_value
        response.status = 200
        response.read.return_value = json.dumps({
            "candidates": [{"content": {"parts": [
                {"thought": True, "text": "hidden"}, {"text": "Abra Novo produto."},
            ]}}],
        }).encode()
        with patch("support.provider_settings", return_value=self.settings):
            self.assertEqual(self.client.get("/suporte/status").json["mode"], "online")
            result = self.message("Como cadastrar produto FicticioInterno123?", history=["email: pessoa@example.com"])
            self.assertEqual(result.json, {"answer": "Abra Novo produto.", "mode": "online"})
            method, endpoint, payload, headers = connection.return_value.request.call_args.args
            self.assertEqual(method, "POST")
            self.assertTrue(endpoint.endswith(":generateContent"))
            self.assertEqual(headers["x-goog-api-key"], "test-key")
            self.assertIn("como cadastrar produto", payload)
            self.assertNotIn("ficticiointerno", payload)
            self.assertNotIn("example.com", payload)
            connection.assert_called_with("generativelanguage.googleapis.com", timeout=7)
            self.assertNotIn("test-key", result.get_data(as_text=True))
            connection.reset_mock()
            self.assertEqual(self.message("Minha senha: exemplo123").json["mode"], "local")
            connection.assert_not_called()

    @patch("support.http.client.HTTPSConnection")
    def test_provider_timeout_returns_faq_and_updates_status(self, connection):
        connection.return_value.getresponse.side_effect = TimeoutError
        with patch("support.provider_settings", return_value=self.settings):
            result = self.message("Como cadastrar categoria?")
            self.assertEqual(result.json["mode"], "offline")
            self.assertIn("Adicionar categoria", result.json["answer"])
            self.assertEqual(self.client.get("/suporte/status").json["mode"], "offline")
            connection.assert_called_once()

    @patch("support.http.client.HTTPSConnection")
    def test_provider_rejection_returns_faq(self, connection):
        connection.return_value.getresponse.return_value.status = 429
        with patch("support.provider_settings", return_value=self.settings):
            self.assertEqual(self.message("Como entrar?").json["mode"], "offline")

    def test_bad_input_and_csrf(self):
        path = "/suporte/mensagens"
        self.assertEqual(self.client.post(path, data={"message": "login"}).status_code, 400)
        self.assertEqual(self.client.post(path, json={"message": "login"}).status_code, 415)
        self.assertEqual(self.message("x" * 17000).status_code, 413)
        for text in ("", "x" * (MAX_MESSAGE + 1), "produto\x00"):
            self.assertEqual(self.message(text).status_code, 400)
        self.assertEqual(self.message("produto", history=["produto"] * 4).status_code, 400)

    @patch("support.provider_settings", return_value=None)
    def test_anonymous_rate_limit_and_handoff(self, _):
        for _ in range(8):
            self.assertEqual(self.message("Como entrar?").status_code, 200)
        blocked = self.message("Como entrar?")
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.headers["Retry-After"], "60")
        result = self.client.post("/suporte/atendimento", data={"csrf_token": self.csrf()})
        self.assertEqual(result.json, {"state": "waiting", "connected": False})
