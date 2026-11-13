# ADR-002: TypeSafe AI com Zod e Detecção de Mudança de Tela (*Smart Frames*)

- **Status:** Aceita
- **Data:** 2026-11-13
- **Contexto:** Sessões multimodais ao vivo (áudio + vídeo/tela + contexto de IDE) sofrem de dois riscos críticos em produção: (1) respostas ou mensagens de protocolo malformadas que quebram a UI ou corrompem estado; e (2) custo elevado e poluição da janela de contexto ao enviar capturas de tela contínuas mesmo quando o desenvolvedor está parado lendo código.

## Decisão

1. **TypeSafe AI com Zod:**
   - Todos os contratos de saída estruturada da IA, mensagens do protocolo WebSocket (`ide-extension` <-> `desktop-app`) e configurações de sessão serão validados em runtime com schemas **Zod**.
   - Falhas de parsing não derrubam o loop da sessão: são convertidas em erros tipados com fallback seguro para texto bruto ou descarte controlado.

2. **Detecção de Mudança de Tela (*Smart Frames*):**
   - Antes de encaminhar um frame capturado para a Gemini Live API, o pipeline calcula a diferença visual em relação ao último frame enviado (comparação leve por hash/amostragem de pixels).
   - Apenas frames cuja variação supere o limiar configurado (ou após intervalo máximo de *heartbeat*, se habilitado) são transmitidos.

## Alternativas Consideradas

- **Apenas interfaces TypeScript (`tsc`) sem validação em runtime:** Rejeitada porque tipos TypeScript são apagados em runtime e não protegem contra payloads inesperados de LLMs ou clientes WebSocket externos.
- **Envio fixo de screenshots por intervalo (ex.: 1 FPS contínuo):** Rejeitada por desperdiçar tokens multimodais, saturar banda e degradar a atenção do modelo com frames redundantes.

## Consequências

- **Positivas:** Redução drástica no consumo de tokens de visão durante pausas de leitura; contratos auditáveis e testáveis unitariamente; UI blindada contra dados inválidos.
- **Negativas:** Pequeno overhead de CPU local para comparação de frames e necessidade de calibrar o limiar de sensibilidade para não ignorar mudanças sutis (ex.: tooltip ou linha de erro).
