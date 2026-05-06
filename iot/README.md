# IoT — Simulação do Dispenser (Wokwi + ESP32)

Simulação do dispenser físico de medicamentos usando ESP32 no [Wokwi](https://wokwi.com).
O ESP32 se comunica com o backend via MQTT (broker público HiveMQ).

## Componentes simulados

| Componente       | Pino ESP32 |
|------------------|------------|
| LED vermelho     | GPIO 15    |
| Botão verde      | GPIO 13    |
| Buzzer           | GPIO 14    |
| Servo motor      | GPIO 16    |
| Display LCD 16x2 | SDA 21 / SCL 22 (I2C) |

## Tópicos MQTT

| Direção           | Tópico                  | Descrição                              |
|-------------------|-------------------------|----------------------------------------|
| Backend → ESP32   | `smartpills/dispense`   | Comando para dispensar um medicamento  |
| ESP32 → Backend   | `smartpills/dispensed`  | Confirmação de que o paciente retirou  |

Broker: `broker.hivemq.com:1883` (público, sem autenticação)

## Como rodar no Wokwi

### 1. Criar o projeto

1. Acesse [wokwi.com](https://wokwi.com) e faça login
2. Clique em **New Project** → selecione **ESP32**

### 2. Copiar os arquivos

O projeto usa três arquivos — substitua o conteúdo padrão pelo conteúdo de cada arquivo desta pasta:

| Arquivo no Wokwi  | Arquivo desta pasta |
|-------------------|---------------------|
| `sketch.ino`      | `sketch.ino`        |
| `diagram.json`    | `diagram.json`      |
| `libraries.txt`   | `libraries.txt`     |

> **Como editar o `diagram.json` no Wokwi:** clique na aba **diagram.json** no editor e substitua todo o conteúdo pelo arquivo local.

### 3. Instalar as bibliotecas

O Wokwi lê o `libraries.txt` automaticamente e instala as dependências ao iniciar a simulação:

```
ESP32Servo
PubSubClient
ArduinoJson
LiquidCrystal_I2C
```

### 4. Iniciar a simulação

1. Clique em **▶ Start Simulation**
2. Aguarde a mensagem no Serial Monitor:
   ```
   WiFi conectado!
   MQTT conectado!
   Inscrito no topico: smartpills/dispense
   ```
3. O LCD exibirá **"Aguardando..."** — o dispenser está pronto

## Fluxo de dispensação

```
App (frontend)
    → POST /api/dispensation/trigger/{event_id}
        → Backend publica em smartpills/dispense
            → ESP32 recebe o comando
                → Servo abre (90°), LED acende, buzzer bipa 3x
                → LCD exibe nome e dosagem do medicamento
                    → Paciente pressiona o botão verde
                        → Servo fecha (0°), LED apaga
                        → ESP32 publica em smartpills/dispensed
                            → Backend atualiza status → "confirmed"
```

## Observações

- A rede WiFi `Wokwi-GUEST` é emulada pelo próprio Wokwi — não precisa configurar nada
- O broker HiveMQ é público; qualquer cliente conectado ao mesmo tópico receberá as mensagens
- O botão verde simula o paciente retirando o medicamento do compartimento
