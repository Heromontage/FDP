#include <WiFi.h>
#include <WebServer.h>

IPAddress local_IP(172, 20, 10, 6); 
IPAddress gateway(172, 20, 10, 1);    
IPAddress subnet(255, 255, 255, 0);

const char* ssid = "Mehul’s iPhone";
const char* password = "mahi2604";
WebServer server(80);

// --- Pins ---
const int trigFR = 5, echoFR = 17;
const int trigMR = 18, echoMR = 19;
const int trigF  = 16, echoF  = 4;

const int ENA = 14, IN1 = 27, IN2 = 26;
const int ENB = 32, IN3 = 25, IN4 = 33;

const int led = 2;

// --- State ---
bool isRunning = false;
bool concaveDetected = false;
char statusMsg[25] = "IDLE";

// --- Sensors ---
float fr = 0, mr = 0, f = 0;

// --- Tunable params ---
float targetMin = 6.0;
float targetMax = 10.0;
float angularVel = 0.34;
float targetAngle = 1500.0;
float concaveThreshold = 8.0;

int followSpeed = 180;
int turnOuter = 180;
int turnInner = 120;

float theta = 0;
unsigned long turnStart = 0;

// ---------------- HARD BRAKE ----------------
void hardStop() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, HIGH);
  ledcWrite(ENA, 0);
  ledcWrite(ENB, 0);
}

// ---------------- DRIVE ----------------
void drive(int L, int R) {
  if (!isRunning) { hardStop(); return; }

  int temp = L; L = R; R = temp;

  digitalWrite(IN1, L >= 0);
  digitalWrite(IN2, L < 0);
  digitalWrite(IN3, R >= 0);
  digitalWrite(IN4, R < 0);

  ledcWrite(ENA, abs(L));
  ledcWrite(ENB, abs(R));
}

// ---------------- SENSOR ----------------
float getDist(int t, int e) {
  digitalWrite(t, LOW); delayMicroseconds(2);
  digitalWrite(t, HIGH); delayMicroseconds(10);
  digitalWrite(t, LOW);
  long d = pulseIn(e, HIGH, 18000);
  return (d <= 0) ? 400 : d * 0.034 / 2;
}

// ---------------- MAIN UI ----------------
const char PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { background:#0f172a; color:#fff; font-family:sans-serif; text-align:center; }
.card { background:#1e293b; margin:10px; padding:20px; border-radius:16px; display:inline-block; }
.value { font-size:28px; }
button { padding:12px 25px; margin:10px; border:none; border-radius:10px; }
.start { background:#22c55e; }
.stop { background:#ef4444; }
</style>
</head>

<body>
<h2>ShapeBot</h2>

<div class="card">FR<br><span id="fr" class="value">0</span></div>
<div class="card">MR<br><span id="mr" class="value">0</span></div>
<div class="card">F<br><span id="f" class="value">0</span></div>
<div class="card">Theta<br><span id="t" class="value">0</span></div>

<h3 id="s">---</h3>

<button class="start" onclick="fetch('/start')">START</button>
<button class="stop" onclick="fetch('/stop')">STOP</button>
<br>
<button onclick="location.href='/tunePage'">Advanced</button>

<script>
setInterval(()=>{
 fetch('/data').then(r=>r.json()).then(j=>{
  fr.innerHTML=j.fr.toFixed(1);
  mr.innerHTML=j.mr.toFixed(1);
  f.innerHTML=j.f.toFixed(1);
  t.innerHTML=j.theta.toFixed(1);
  s.innerHTML=j.msg;
 });
},300);
</script>
</body>
</html>
)rawliteral";

// ---------------- TUNE PAGE ----------------
const char TUNE_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<style>
body { background:#000; color:#0ff; font-family:sans-serif; text-align:center; }
input { width:100px; padding:6px; margin:5px; }
button { padding:10px 20px; margin:10px; background:#0ff; border:none; }
</style>
</head>

<body>
<h2>Advanced Tuning</h2>

AngularVel<br><input id="av"><br>
TargetAngle<br><input id="ta"><br>
TargetMin<br><input id="tmin"><br>
TargetMax<br><input id="tmax"><br>
FollowSpeed<br><input id="fs"><br>
TurnOuter<br><input id="to"><br>
TurnInner<br><input id="ti"><br>
ConcaveThreshold<br><input id="ct"><br>

<button onclick="send()">Apply</button>
<br><br>
<button onclick="location.href='/'">Back</button>

<hr>

FR:<span id="fr">0</span><br>
MR:<span id="mr">0</span><br>
F:<span id="f">0</span><br>
Theta:<span id="t">0</span><br>
Status:<span id="s">---</span>

<script>
function send(){
 fetch(`/setParams?av=${av.value}&ta=${ta.value}&tmin=${tmin.value}&tmax=${tmax.value}&fs=${fs.value}&to=${to.value}&ti=${ti.value}&ct=${ct.value}`);
}

setInterval(()=>{
 fetch('/data').then(r=>r.json()).then(j=>{
  fr.innerHTML=j.fr.toFixed(1);
  mr.innerHTML=j.mr.toFixed(1);
  f.innerHTML=j.f.toFixed(1);
  t.innerHTML=j.theta.toFixed(1);
  s.innerHTML=j.msg;
 });
},300);
</script>
</body>
</html>
)rawliteral";

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);

  pinMode(IN1,OUTPUT); pinMode(IN2,OUTPUT);
  pinMode(IN3,OUTPUT); pinMode(IN4,OUTPUT);

  ledcAttach(ENA,5000,8);
  ledcAttach(ENB,5000,8);

  pinMode(trigFR,OUTPUT); pinMode(echoFR,INPUT);
  pinMode(trigMR,OUTPUT); pinMode(echoMR,INPUT);
  pinMode(trigF, OUTPUT); pinMode(echoF, INPUT);

  pinMode(led,OUTPUT);

  hardStop();
  if (!WiFi.config(local_IP, gateway, subnet)) {
    Serial.println("STA Failed to configure");
  }
  WiFi.begin(ssid,password);
  while (WiFi.status()!=WL_CONNECTED) delay(500);

  WiFi.setHostname("shapebot");

  server.on("/", [](){ server.send_P(200,"text/html",PAGE); });
  server.on("/tunePage", [](){ server.send_P(200,"text/html",TUNE_PAGE); });

  server.on("/start", [](){
    concaveDetected = false;
    isRunning = true;
    theta = 0;
    turnStart = 0;
    strcpy(statusMsg,"RUNNING");
    server.send(200);
  });

  server.on("/stop", [](){
    isRunning = false;
    hardStop();
    strcpy(statusMsg,"STOPPED");
    server.send(200);
  });

  server.on("/setParams", [](){
    if(server.hasArg("av")) angularVel = server.arg("av").toFloat();
    if(server.hasArg("ta")) targetAngle = server.arg("ta").toFloat();
    if(server.hasArg("tmin")) targetMin = server.arg("tmin").toFloat();
    if(server.hasArg("tmax")) targetMax = server.arg("tmax").toFloat();
    if(server.hasArg("fs")) followSpeed = server.arg("fs").toInt();
    if(server.hasArg("to")) turnOuter = server.arg("to").toInt();
    if(server.hasArg("ti")) turnInner = server.arg("ti").toInt();
    if(server.hasArg("ct")) concaveThreshold = server.arg("ct").toFloat();
    server.send(200,"text/plain","OK");
  });

  server.on("/data", [](){
    char j[200];
    snprintf(j,sizeof(j),
      "{\"msg\":\"%s\",\"fr\":%.1f,\"mr\":%.1f,\"f\":%.1f,\"theta\":%.1f}",
      statusMsg, fr, mr, f, theta);
    server.send(200,"application/json",j);
  });

  server.begin();
}

// ---------------- LOOP ----------------
void loop() {

  server.handleClient();

  fr = getDist(trigFR, echoFR);
  mr = getDist(trigMR, echoMR);
  f  = getDist(trigF, echoF);

  if (concaveDetected) {
    hardStop();
    strcpy(statusMsg,"CONCAVE LOCKED");
    return;
  }

  if (!isRunning) {
    hardStop();
    return;
  }

  if (f <= concaveThreshold) {
    hardStop();
    concaveDetected = true;
    isRunning = false;
    strcpy(statusMsg,"CONCAVE");
    return;
  }

  if (theta >= targetAngle) {
    hardStop();
    strcpy(statusMsg,"CONVEX");
    return;
  }

  if (mr >= targetMin && mr <= targetMax) {
    drive(followSpeed, followSpeed);
    strcpy(statusMsg,"FOLLOW");
  }

  else if (fr >= targetMax && mr >= targetMax) {
    if (turnStart == 0) turnStart = millis();

    drive(turnInner, turnOuter);
    strcpy(statusMsg,"TURN");

    unsigned long now = millis();
    float dt = (now - turnStart) / 1000.0;
    theta += angularVel * dt * (180 / PI);
    turnStart = now;
  }

  else if (mr < targetMin) {
    drive(turnOuter, turnInner);
    strcpy(statusMsg,"TOO CLOSE");
  }

  else {
    drive(followSpeed, followSpeed);
  }

  delay(10);
}