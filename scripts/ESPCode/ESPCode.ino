#include <WiFi.h>
#include <WebServer.h>

// --- WiFi Settings ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
WebServer server(80);

// --- Motor Pins (Example for L298N) ---
const int ENA = 14; 
const int IN1 = 27; 
const int IN2 = 26; 
const int IN3 = 25; 
const int IN4 = 33; 
const int ENB = 32;

// --- Sensor Pins (Ultrasonic) ---
const int TRIG_FRONT = 5;
const int ECHO_FRONT = 18;
const int TRIG_SIDE = 19;
const int ECHO_SIDE = 21;

// --- Odometry / State ---
float x = 0.0, y = 0.0, theta = 0.0;
float front_dist = 0.0, side_dist = 0.0;
unsigned long lastTime = 0;

void setupMotors() {
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  
  // Set default speed
  analogWrite(ENA, 150);
  analogWrite(ENB, 150);
}

void setMotors(int leftSpeed, int rightSpeed) {
  // Left Motor
  digitalWrite(IN1, leftSpeed > 0 ? HIGH : LOW);
  digitalWrite(IN2, leftSpeed < 0 ? HIGH : LOW);
  analogWrite(ENA, abs(leftSpeed));

  // Right Motor
  digitalWrite(IN3, rightSpeed > 0 ? HIGH : LOW);
  digitalWrite(IN4, rightSpeed < 0 ? HIGH : LOW);
  analogWrite(ENB, abs(rightSpeed));
}

float readDistance(int trig, int echo) {
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long duration = pulseIn(echo, HIGH, 30000); // 30ms timeout
  if (duration == 0) return 999.0;
  return (duration * 0.0343) / 2.0;
}

void setup() {
  Serial.begin(115200);
  setupMotors();
  
  pinMode(TRIG_FRONT, OUTPUT); pinMode(ECHO_FRONT, INPUT);
  pinMode(TRIG_SIDE, OUTPUT); pinMode(ECHO_SIDE, INPUT);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nIP Address: ");
  Serial.println(WiFi.localIP());

  // Python bridge requests this endpoint
  server.on("/", []() {
    char buf[64];
    // Return: x y theta
    sprintf(buf, "%d %d %.2f", (int)x, (int)y, theta);
    server.send(200, "text/plain", buf);
  });

  server.on("/sensors", []() {
    char buf[128];
    sprintf(buf, "{\"front_dist\": %.2f, \"side_dist\": %.2f}", front_dist, side_dist);
    server.send(200, "application/json", buf);
  });

  server.begin();
}

void loop() {
  server.handleClient();
  
  // 1. Read Sensors
  front_dist = readDistance(TRIG_FRONT, ECHO_FRONT);
  side_dist = readDistance(TRIG_SIDE, ECHO_SIDE);

  // 2. Wall Following Logic (Circle the object)
  int target_side = 10; // Keep 10cm from the object on the side
  
  if (front_dist < 15) {
    // Obstacle ahead: Turn sharply away
    setMotors(150, -100); 
  } else {
    // Adjust side distance to curve around the object
    int error = target_side - side_dist; 
    int base_speed = 120;
    
    // Simple Proportional control to keep distance
    int correction = error * 5; 
    
    // Left motor (outside), Right motor (inside near object)
    setMotors(base_speed + correction, base_speed - correction);
  }

  // 3. Simple Odometry Mockup (For Demo/Integration purposes)
  // In a real scenario, you'd use encoders to increment x, y, and theta.
  unsigned long now = millis();
  float dt = (now - lastTime) / 1000.0;
  lastTime = now;
  
  // Simulated rotation for the python bridge
  theta += 10.0 * dt; 
  if (theta >= 360) theta = 0;
  x += 5.0 * cos(theta * PI / 180.0) * dt;
  y += 5.0 * sin(theta * PI / 180.0) * dt;

  delay(50);
}