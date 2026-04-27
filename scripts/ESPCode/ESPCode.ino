#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <math.h>

// --- NETWORK SETUP ---
IPAddress local_IP(172, 20, 10, 6); 
IPAddress gateway(172, 20, 10, 1);    
IPAddress subnet(255, 255, 255, 0);

const char *ssid = "Mehul’s iPhone"; 
const char *password = "mahi2604"; 

// --- SAFE ULTRASONIC PINS ---
#define echo1 4
#define trig1 16

#define echo2 17  // SIDE SENSOR 1 (Front-Side)
#define trig2 5

#define echo3 19  // SIDE SENSOR 2 (Back-Side)
#define trig3 18

// --- SAFE MOTOR DRIVER PINS ---
#define en12 14
#define in1  27
#define in2  26  
#define in3  25  
#define in4  33  
#define en34 32

float front_distance, side_front_dist, side_back_dist;
float msTocm = 0.0343 / 2;

// --- ODOMETRY ---
float x = 0.0, y = 0.0, theta = 0.0;

// --- DUAL-SENSOR PID VARIABLES ---
float targetDistance = 10.0; // Stay 10cm from the wall
float Kp_dist = 8.0;         // Aggressiveness for fixing distance
float Kp_angle = 12.0;       // Aggressiveness for fixing rotation/angle
int baseSpeed = 150;         // Forward speed (0-255)

AsyncWebServer server(80);

void wifi_init(){
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");

  IPAddress ip = WiFi.localIP();
  Serial.println("***************************************");
  Serial.print("IP Address: ");
  Serial.println(ip);
  Serial.println("***************************************");

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "text/plain", fetch());
  });
  server.begin();
}

String fetch(){
  return String(x) + " " + String(y) + " " + String(theta);
}

void setup() {
  Serial.begin(115200);
  if (!WiFi.config(local_IP, gateway, subnet)) {
    Serial.println("STA Failed to configure");
  }

  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  wifi_init();

  pinMode(in1, OUTPUT); pinMode(in2, OUTPUT); pinMode(en12, OUTPUT);
  pinMode(in3, OUTPUT); pinMode(in4, OUTPUT); pinMode(en34, OUTPUT);
  
  pinMode(trig1, OUTPUT); pinMode(echo1, INPUT);
  pinMode(trig2, OUTPUT); pinMode(echo2, INPUT);
  pinMode(trig3, OUTPUT); pinMode(echo3, INPUT); // Added 3rd sensor

  digitalWrite(in1, LOW); digitalWrite(in2, LOW);  
  digitalWrite(in3, LOW); digitalWrite(in4, LOW);
}

float getFrontDist() {
  digitalWrite(trig1, LOW); delay(2);
  digitalWrite(trig1, HIGH); delay(5);
  digitalWrite(trig1, LOW);
  long duration = pulseIn(echo1, HIGH, 30000);
  return abs(duration * msTocm);
}

float getSideFrontDist() {
  digitalWrite(trig2, LOW); delay(2);
  digitalWrite(trig2, HIGH); delay(5);
  digitalWrite(trig2, LOW);
  long duration = pulseIn(echo2, HIGH, 30000);
  return abs(duration * msTocm);
}

float getSideBackDist() {
  digitalWrite(trig3, LOW); delay(2);
  digitalWrite(trig3, HIGH); delay(5);
  digitalWrite(trig3, LOW);
  long duration = pulseIn(echo3, HIGH, 30000);
  return abs(duration * msTocm);
}

void setMotors(int leftSpeed, int rightSpeed) {
  leftSpeed = constrain(leftSpeed, 0, 255);
  rightSpeed = constrain(rightSpeed, 0, 255);

  digitalWrite(in1, HIGH); digitalWrite(in2, LOW);
  analogWrite(en12, leftSpeed); 

  digitalWrite(in3, HIGH); digitalWrite(in4, LOW);
  analogWrite(en34, rightSpeed);
}

void stopMotors() {
  digitalWrite(in1, LOW); digitalWrite(in2, LOW);
  digitalWrite(in3, LOW); digitalWrite(in4, LOW);
  analogWrite(en12, 0);   analogWrite(en34, 0);
}

void loop() {
  front_distance = getFrontDist();
  side_front_dist = getSideFrontDist();
  side_back_dist = getSideBackDist();

  if (front_distance > 0 && front_distance < 15) {
    // Emergency Brake
    stopMotors();
  } else if (side_front_dist > 0 && side_front_dist < 100 && side_back_dist > 0 && side_back_dist < 100) {
    // --- ADVANCED P-CONTROLLER ---
    
    // 1. Distance Error (How far are we from 10cm?)
    float dist_error = side_front_dist - targetDistance;
    
    // 2. Angle Error (Are we parallel? If front > back, we are pointing away from the wall)
    float angle_error = side_front_dist - side_back_dist;

    // 3. Combined Correction
    float correction = (Kp_dist * dist_error) + (Kp_angle * angle_error);

    // IMPORTANT: STEERING DIRECTION
    // Assuming sensors are on the LEFT wall. If correction is positive (too far away), 
    // we want to turn LEFT toward the wall. To turn left, we slow down the left wheel and speed up the right wheel.
    int leftSpeed = baseSpeed - correction;  
    int rightSpeed = baseSpeed + correction; 

    /* Note: If your sensors are on the RIGHT side of the robot instead of the left, 
       just swap the plus and minus signs above!
       leftSpeed = baseSpeed + correction;
       rightSpeed = baseSpeed - correction; */

    setMotors(leftSpeed, rightSpeed);
    y += 1.0; 
  } else {
    // Lost the wall? Just drive straight
    setMotors(baseSpeed, baseSpeed);
    y += 1.0;
  }
  // --- ADD THIS TO YOUR LOOP() ---
  Serial.print("Front: "); Serial.print(front_distance);
  Serial.print(" cm | Front-Side: "); Serial.print(side_front_dist);
  Serial.print(" cm | Back-Side: "); Serial.println(side_back_dist);
  // -------------------------------
  delay(50);
}