# TechStock Manager V4

## Assets e licenças

| Recurso | Origem e licença |
|---|---|
| Processador, cooler e placa-mãe | Geometrias e mapas procedurais do projeto em `static/js/hardware.js`. As seis imagens fornecidas orientaram a construção e a escolha de materiais. |
| Água-viva, cardume, partículas e vidro | Geometrias, shaders e materiais procedurais do projeto, com referência visual em [Noomo Agency](https://noomoagency.com/) e [The Jellyfish Interactive Experience](https://noomoagency.com/work/noomo-labs-the-jellyfish). |
| Marca | PNGs existentes em `static/image/logos/`, fornecidos com o projeto. A versão branca é usada nas superfícies escuras e o símbolo branco no favicon. A distribuição segue os direitos do proprietário da marca. |
| Three.js | Biblioteca local, MIT, conforme `static/vendor/THREE-LICENSE.txt`. |
| GSAP e ScrollTrigger | Bibliotecas locais, termos indicados nos cabeçalhos dos arquivos vendorizados. [Licença GSAP](https://gsap.com/standard-license/). |
| Inter e Space Grotesk | Fontes locais, SIL Open Font License 1.1. Textos da licença em `static/vendor/`. |

## Qualidade

A seleção automática considera o dispositivo e o tamanho de viewport. Para comparar os modos no mesmo dispositivo, abra a landing com `?qualidade=alta`, `?qualidade=media` ou `?qualidade=baixa`. A qualidade reduz os efeitos e a resolução de renderização, preservando os três modelos. A refração física da campânula está no modo alto. Os demais modos usam a campânula translucente com shader.

## Limites da implementação

A modelagem procedural usa geometrias instanciadas, mapas gerados de rugosidade e relevo e um ambiente de estúdio gerado localmente. Os três modelos usam código e os materiais Three.js locais. O projeto ainda não dispõe de GLB profissional ou de ambiente HDRI fotográfico para esta cena.

## Validação

- Flask e SQLite local de teste. Os 18 testes de `unittest` passaram, incluindo autenticação, acesso ao painel e rotas administrativas.
- Chrome headless com SwiftShader e WebGL. Capturas em 960 × 620 e 390 × 760. Estados observados em avanço, retrocesso, redimensionamento e perto das entradas e saídas.
- Nos pontos inspecionados, cada queda mostrou apenas seu modelo. Os três intervalos ficaram sem hardware e o botão de login apareceu com os três modelos ocultos.
- Os pontos usados para as capturas incluem 44,3% para a ascensão, 52,1% para a placa-mãe, 65,1% para o cooler, 78,2% para o processador e 99,7% para a composição final.
- A renderização por software permite a inspeção funcional e visual. A taxa de quadros nos computadores escolares ainda precisa ser medida.
