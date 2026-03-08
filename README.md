# Smart Pills Dispenser 💊                                                                                                                                        

Dispenser Inteligente de Medicamentos — TCC 2, Ciência da Computação, UNISINOS.                                                                                   

## Sobre o Projeto                                                                                                                                                

Ecossistema IoT com IA para gerenciamento de medicamentos, indo além da automação mecânica tradicional. O sistema interpreta prescrições médicas por foto, oferece um assistente conversacional com contexto do paciente e monitora ativamente doses não confirmadas — alertando cuidadores quando necessário.

## Diferenciais

- **Interpretação de prescrição por imagem** — foto da receita médica é processada pelo Gemini Vision e convertida em dados estruturados automaticamente
- **Assistente IA com contexto do paciente** — chat que conhece os medicamentos, horários e histórico do usuário
- **Monitoramento ativo de doses** — detecta doses não confirmadas e envia alerta por email ao cuidador/familiar
- **Integração IoT** — ESP32 simulado no Wokwi se comunica via MQTT com o backend

## Arquitetura                                                                                                                                                    

wip
                                                                                                                                                                                                           
## Stack                                                                                                                                                                                                                                  
  | Camada | Tecnologia |                                                                                                                                                                                  
  |--------|-----------|                                                                                                                                                                                   
  | Frontend | React 18 + Vite |                                                                                                                                                                           
  | Backend | Python 3.11 + FastAPI |
  | Banco de dados | PostgreSQL (Supabase) |
  | IA / LLM | Google Gemini API |                                                                                                                                                                         
  | IoT | ESP32 (Wokwi) + MQTT (HiveMQ Cloud) |                                                                                                                                                                                                                                                                                                                                                     
## Status                                                                                                                                                       🚧 Em desenvolvimento — MVP acadêmico     
