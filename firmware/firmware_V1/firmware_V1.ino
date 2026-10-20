#include <Arduino.h>

// Hardware Configuration (Direct wire to GPIO 34 / ADC1_CH6)
const int ADC_PIN = 34;          
const float V_REF = 3.3;         
const float ADC_MAX = 4095.0;    
const float SFU_SCALE = 180.0;   

float peakSFU = 0.0;
const int NUM_SAMPLES = 64;      // Boosted oversampling for clean direct-ADC reading

void setup() {
  Serial.begin(115200);
  delay(500);
  
  pinMode(ADC_PIN, INPUT);
  analogSetAttenuation(ADC_11db);
  
  Serial.println(F("[ESP32] Radiometer acquisition online."));
}

void loop() {
  // 1. Oversample raw ADC to smooth direct-pin micro-jitter
  uint32_t rawSum = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    rawSum += analogRead(ADC_PIN);
    delayMicroseconds(100);
  }
  float rawADC = (float)rawSum / (float)NUM_SAMPLES;
  
  // 2. Convert to voltage and SFU
  float voltage = (rawADC / ADC_MAX) * V_REF;
  float currentSFU = voltage * SFU_SCALE;
  
  // 3. Track session peak
  if (currentSFU > peakSFU) {
    peakSFU = currentSFU;
  }

  // 4. Generate passband spectrum profile relative to power level
  float spectrumBins[16];
  for (int i = 0; i < 16; i++) {
    float centerBell = exp(-pow(i - 7.5, 2) / 18.0);
    spectrumBins[i] = currentSFU * 0.06 * (0.8 + 0.4 * centerBell);
  }

  // 5. Stream strict JSON payload matching bridge.js ingestion parser
  Serial.print("{\"source\":\"esp32\",\"totalPower\":");
  Serial.print(currentSFU, 2);
  Serial.print(",\"spectrum\":[");
  for (int i = 0; i < 16; i++) {
    Serial.print(spectrumBins[i], 2);
    if (i < 15) Serial.print(",");
  }
  Serial.print("],\"raw\":");
  Serial.print(rawADC, 2);
  Serial.print(",\"v\":");
  Serial.print(voltage, 4);
  Serial.print(",\"peak\":");
  Serial.print(peakSFU, 2);
  Serial.println("}");
  
  delay(250); // 4 Hz sample rate
}