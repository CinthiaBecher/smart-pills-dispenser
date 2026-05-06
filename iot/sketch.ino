#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

#define LED_PIN 15
#define BUTTON_PIN 13
#define BUZZER_PIN 14
#define SERVO_PIN 16

const char* ssid = "Wokwi-GUEST";
const char* password = "";

const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

const char* topic_sub = "smartpills/dispense";
const char* topic_pub = "smartpills/dispensed";

WiFiClient espClient;
PubSubClient client(espClient);

LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo dispenserServo;

String event_id = "";
String schedule_id = "";

bool busy = false;

void showWaiting() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Aguardando...");
}

void beep() {
  tone(BUZZER_PIN, 1000);
  delay(50);
  noTone(BUZZER_PIN);
  delay(100);
}

void setup_wifi() {
  Serial.print("Conectando ao WiFi");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi conectado!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.println("Conectando ao MQTT...");

    String clientId = "SmartPillsESP32-";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT conectado!");
      client.subscribe(topic_sub);
      Serial.print("Inscrito no topico: ");
      Serial.println(topic_sub);
    } else {
      Serial.print("Falhou, rc=");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

void publishDispensed() {
  StaticJsonDocument<128> doc;

  doc["event_id"] = event_id;
  doc["schedule_id"] = schedule_id;

  char buffer[128];
  serializeJson(doc, buffer);

  client.publish(topic_pub, buffer);

  Serial.print("Publicado em ");
  Serial.print(topic_pub);
  Serial.print(": ");
  Serial.println(buffer);
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.println("Mensagem recebida!");

  if (busy) {
    Serial.println("Sistema ocupado, ignorando mensagem...");
    return;
  }

  StaticJsonDocument<256> doc;

  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.println("Erro ao ler JSON!");
    return;
  }

  const char* receivedEventId = doc["event_id"];
  const char* receivedScheduleId = doc["schedule_id"];
  const char* medicationName = doc["medication_name"];
  const char* medicationDosage = doc["medication_dosage"];

  if (!receivedEventId || !receivedScheduleId || !medicationName || !medicationDosage) {
    Serial.println("JSON incompleto!");
    return;
  }

  busy = true;

  event_id = receivedEventId;
  schedule_id = receivedScheduleId;

  String name = String(medicationName);
  String dose = String(medicationDosage);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(name.substring(0, 16));

  lcd.setCursor(0, 1);
  lcd.print((dose + " Retirar!").substring(0, 16));

  digitalWrite(LED_PIN, HIGH);

  beep();
  beep();
  beep();

  dispenserServo.write(90);

  Serial.println("Compartimento aberto. Aguardando botao...");
}

void setup() {
  Serial.begin(115200);
  randomSeed(micros());

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  dispenserServo.attach(SERVO_PIN);
  dispenserServo.write(0);

  lcd.init();
  lcd.backlight();
  showWaiting();

  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }

  client.loop();

  if (busy && digitalRead(BUTTON_PIN) == LOW) {
    delay(50);

    if (digitalRead(BUTTON_PIN) == LOW) {
      Serial.println("Medicamento retirado!");

      dispenserServo.write(0);
      digitalWrite(LED_PIN, LOW);

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Retirado!");
      lcd.setCursor(0, 1);
      lcd.print("Obrigado");
      delay(2000);

      publishDispensed();

      event_id = "";
      schedule_id = "";
      busy = false;

      showWaiting();

      while (digitalRead(BUTTON_PIN) == LOW) {
        client.loop();
        delay(10);
      }
    }
  }
}