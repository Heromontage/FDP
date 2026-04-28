#include <WiFi.h>
#include <WebServer.h>

IPAddress local_IP(172, 20, 10, 6); 
IPAddress gateway(172, 20, 10, 1);    
IPAddress subnet(255, 255, 255, 0);

const char* ssid = "Mehul’s iPhone";
const char* password = "mahi2604";
WebServer server(80);

// --- Pinout (No Changes) ---A
const int ENA = 14, IN1 = 27, IN2 = 26;
const int ENB = 32, IN3 = 25, IN4 = 33;
const int trigFR = 5, echoFR = 17;
const int trigBR = 18, echoBR = 19;
const int trigF = 16, echoF = 4;

// --- STATE MACHINE (No Changes) ---
bool isRunning = false;
char statusMsg[40] = "System Idle";
enum State { FOLLOWING, DRIVE_PAST, PIVOT_RIGHT, STOPPED };
State currentState = STOPPED;

// --- TELEMETRY ---
float frFilt = 15.0, brFilt = 15.0;
float prevAngErr = 0, prevDistErr = 0;
int curL = 0, curR = 0;
unsigned long stateTimer = 0;
bool sensorToggle = true;

// --- TUNABLE PARAMETERS (Exposed) ---
float Kpa = 5.0, Kda = 2.0;    
float Kpd = 10.0, Kdd = 1.0;   
int bSpd = 180, pSpd = 170;    
int ramp = 35;                 
float tDist = 15.0;            
float cThr = 35.0;             
float eThr = 20.0;             
int pTime = 1800;              
float alp = 0.3;               
float sLim = 10.0;             

// ---------------- POWER ----------------
void drive(int left, int right) {
  if (!isRunning) { left = 0; right = 0; }
  if (left > curL) curL += min(ramp, left - curL);
  else if (left < curL) curL -= min(ramp, curL - left);
  if (right > curR) curR += min(ramp, right - curR);
  else if (right < curR) curR -= min(ramp, curR - right);

  digitalWrite(IN1, curL >= 0 ? HIGH : LOW);
  digitalWrite(IN2, curL >= 0 ? LOW : HIGH);
  digitalWrite(IN3, curR >= 0 ? HIGH : LOW);
  digitalWrite(IN4, curR >= 0 ? LOW : HIGH);
  ledcWrite(ENA, abs(curL));
  ledcWrite(ENB, abs(curR));
}

// ---------------- SENSORS ----------------
float getDist(int trig, int echo) {
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 18000); 
  float d = (dur <= 0) ? 400.0 : (dur * 0.034 / 2);
  return d;
}

void updateSensors() {
  float r = sensorToggle ? getDist(trigFR, echoFR) : getDist(trigBR, echoBR);
  if (isRunning && r < sLim) { isRunning = false; strncpy(statusMsg, "SAFETY STOP", 40); }
  if (sensorToggle) frFilt = (alp * r) + ((1.0 - alp) * frFilt);
  else brFilt = (alp * r) + ((1.0 - alp) * brFilt);
  sensorToggle = !sensorToggle;
}

// ---------------- LOGIC ----------------
void runPID() {
  float aErr = frFilt - brFilt;
  float dErr = ((frFilt + brFilt) / 2.0) - tDist;
  float corr = (Kpa * aErr) + (Kda * (aErr - prevAngErr)) + (Kpd * dErr);
  prevAngErr = aErr;
  int turn = constrain((int)corr, -90, 90);
  drive(bSpd - turn, bSpd + turn);
}

// --- UPDATED UI: NOW SHOWS FR AND BR DISTANCES ---
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:sans-serif;background:#0f172a;color:#fff;text-align:center;margin:0;}
  .telemetry{background:#1e293b;padding:15px;border-bottom:2px solid #334155;display:flex;justify-content:space-around;font-weight:bold;color:#10b981;font-size:1.2em;}
  .grid{display:flex;flex-wrap:wrap;justify-content:center;}
  .card{background:#1e293b;padding:15px;margin:5px;border-radius:10px;border:1px solid #334155;width:180px;}
  input{width:100%;margin-top:10px;} label{font-size:12px;color:#94a3b8;}
  .btn{padding:15px;width:45%;margin:10px;font-weight:bold;border-radius:8px;border:none;cursor:pointer;}
</style></head><body>
  <div class="telemetry">
    <div>FR: <span id="v_fr">0.0</span></div>
    <div>BR: <span id="v_br">0.0</span></div>
  </div>
  <div style="background:#334155;padding:10px;">Status: <span id="st">-</span></div>
  <div class="grid">
    <div class="card"><label>Kp Angle</label><input type="range" id="ka" min="0" max="30" step="0.1" onchange="u()"></div>
    <div class="card"><label>Kd Angle</label><input type="range" id="kda" min="0" max="10" step="0.1" onchange="u()"></div>
    <div class="card"><label>Kp Dist</label><input type="range" id="kp" min="0" max="20" step="0.1" onchange="u()"></div>
    <div class="card"><label>Kd Dist</label><input type="range" id="kdd" min="0" max="10" step="0.1" onchange="u()"></div>
    <div class="card"><label>Base Spd</label><input type="range" id="bs" min="100" max="255" onchange="u()"></div>
    <div class="card"><label>Piv Spd</label><input type="range" id="ps" min="100" max="255" onchange="u()"></div>
    <div class="card"><label>Corner Thr</label><input type="range" id="ct" min="20" max="100" onchange="u()"></div>
    <div class="card"><label>Drive Past</label><input type="range" id="pt" min="500" max="4000" step="50" onchange="u()"></div>
    <div class="card"><label>Safety Lim</label><input type="range" id="sl" min="5" max="20" onchange="u()"></div>
    <div class="card"><label>Filter Alp</label><input type="range" id="al" min="0.1" max="0.9" step="0.05" onchange="u()"></div>
  </div>
  <button class="btn" style="background:#10b981" onclick="fetch('/start')">START</button>
  <button class="btn" style="background:#f43f5e" onclick="fetch('/stop')">STOP</button>
  <script>
    function u(){
      let q = `?ka=${document.getElementById('ka').value}&kda=${document.getElementById('kda').value}&kp=${document.getElementById('kp').value}&kdd=${document.getElementById('kdd').value}&bs=${document.getElementById('bs').value}&ps=${document.getElementById('ps').value}&ct=${document.getElementById('ct').value}&pt=${document.getElementById('pt').value}&sl=${document.getElementById('sl').value}&al=${document.getElementById('al').value}`;
      fetch('/tune'+q);
    }
    setInterval(()=>{
      fetch('/data').then(r=>r.json()).then(j=>{
        document.getElementById('st').innerHTML=j.msg;
        document.getElementById('v_fr').innerHTML=j.fr.toFixed(1);
        document.getElementById('v_br').innerHTML=j.br.toFixed(1);
      });
    }, 400);
  </script>
</body></html>)rawliteral";

void setup() {
  Serial.begin(115200);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  ledcAttach(ENA, 5000, 8); ledcAttach(ENB, 5000, 8);
  pinMode(trigFR, OUTPUT); pinMode(echoFR, INPUT); pinMode(trigBR, OUTPUT); pinMode(echoBR, INPUT);
  if (!WiFi.config(local_IP, gateway, subnet)) {
    Serial.println("STA Failed to configure");
  }
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  server.on("/", []() { server.send_P(200, "text/html", INDEX_HTML); });
  server.on("/start", []() { isRunning = true; currentState = FOLLOWING; strncpy(statusMsg, "FOLLOWING", 40); server.send(200); });
  server.on("/stop", []() { isRunning = false; currentState = STOPPED; strncpy(statusMsg, "STOPPED", 40); server.send(200); });
  server.on("/tune", []() {
    Kpa = server.arg("ka").toFloat(); Kda = server.arg("kda").toFloat();
    Kpd = server.arg("kp").toFloat(); Kdd = server.arg("kdd").toFloat();
    bSpd = server.arg("bs").toInt(); pSpd = server.arg("ps").toInt();
    cThr = server.arg("ct").toFloat(); pTime = server.arg("pt").toInt();
    sLim = server.arg("sl").toFloat(); alp = server.arg("al").toFloat();
    server.send(200);
  });
  server.on("/data", []() {
    char json[120]; 
    // NOW INCLUDING FR AND BR IN THE JSON DATA
    snprintf(json, sizeof(json), "{\"msg\":\"%s\",\"fr\":%.1f,\"br\":%.1f}", statusMsg, frFilt, brFilt);
    server.send(200, "application/json", json);
  });
  server.begin();
}

void loop() {
  server.handleClient();
  updateSensors();
  yield();
  if (!isRunning) { drive(0,0); return; }

  switch (currentState) {
    case FOLLOWING:
      if (frFilt > cThr) { stateTimer = millis(); currentState = DRIVE_PAST; strncpy(statusMsg, "CORNER DETECTED", 40); }
      else runPID();
      break;
    case DRIVE_PAST:
      drive(bSpd, bSpd);
      if (millis() - stateTimer > pTime) { drive(0,0); delay(200); currentState = PIVOT_RIGHT; stateTimer = millis(); }
      break;
    case PIVOT_RIGHT:
      drive(pSpd, -pSpd);
      if (millis() - stateTimer > 800 && frFilt < eThr) { currentState = FOLLOWING; strncpy(statusMsg, "FOLLOWING", 40); }
      break;
  }
  delay(30);
}