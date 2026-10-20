================================================================================
REALTIME RADIO ASTRONOMY TELESCOPE & SOLAR FLARE MONITOR
YCS Project Submission
Developer: Ishanth Okitha Dahanayake, Gateway College Colombo
================================================================================

1. PROJECT OVERVIEW
-------------------
This project is a low-cost, real-time microwave radio telescope designed to capture 
10.7 GHz Ku-band solar emissions and monitor solar flare activity. The system uses a 
parabolic dish setup coupled with custom C++ microcontroller firmware, a Node.js web 
bridge, a Python telemetry logger, and an interactive HTML/JS "Mission Control" web 
dashboard to visualize incoming radio flux.


2. SYSTEM ARCHITECTURE & TECH STACK
-----------------------------------
- Firmware: Custom C++ running on NodeMCU (ESP8266) / ESP32 DevKit
- Data Bridge: Node.js (Web Serial / WebSockets streaming to browser)
- Data Logger: Python script (Background telemetry capture to CSV)
- Frontend Dashboard: HTML, CSS, JavaScript (16-channel DSP display & rolling flux graph)


3. HARDWARE REQUIREMENTS
------------------------
- Parabolic Dish: Standard 60cm–90cm Ku-band offset satellite dish
- LNB: Ku-band Universal LNB (10.7 GHz frequency downconversion)
- Signal Sensor: Analog Power Log Detector Module
- Power Supply: 12V, 2A DC Power Adapter
- Microcontroller: NodeMCU (ESP8266) or ESP32 DevKit
- Cabling & Accessories: RG6 Coaxial Cable with F-connectors, Breadboard, Jumper Wires, USB Cable
- Computer: PC running Windows 10/11 with Google Chrome or Microsoft Edge


4. SOFTWARE REQUIREMENTS
------------------------
- Arduino IDE (for flashing microcontroller firmware)
- Node.js (for running the WebSocket communication bridge)
- Python 3.x (for running the CSV background data logger)
- Google Chrome or Microsoft Edge (Web Serial API support)


5. QUICK START SETUP
--------------------
1. Hardware Setup:
   a. Mount the Ku-Band LNB on the parabolic dish arm.
   b. Connect RG6 coaxial cable from LNB to the Analog Power Log Detector RF input.
   c. Power the RF sensor and LNB using the 12V DC power adapter.
   d. Connect detector output (VOUT) to pin A0 (ESP8266) or GPIO34 (ESP32) on a breadboard.
   e. Ensure common ground (GND) is shared between detector and microcontroller.
   f. Connect microcontroller to PC via USB.

2. Software Execution:
   a. Flash the custom firmware to the microcontroller using Arduino IDE.
   b. Open terminal and run the data bridge:
      node bridge.js
   c. In a separate terminal window, launch the telemetry logger:
      python logger.py
   d. Open index.html in Google Chrome or Microsoft Edge.
   e. Select the appropriate serial/websocket port on the dashboard to start live streaming.


6. OPERATING INSTRUCTIONS
-------------------------
1. Point the dish at an empty patch of sky away from the Sun to establish a cold-sky baseline.
2. Click "Sky Offset Calibration" on the Mission Control dashboard to zero out background noise.
3. Slowly pan the dish toward the Sun (note: Earth's rotation shifts the Sun ~1° every 4 minutes).
4. Observe the rolling line graph and 16-channel DSP spectrum bars spike as solar flux is detected.


7. TESTING SUMMARY
------------------
- Hardware Testing:
  * Clear Sky Baseline Test: Verified steady baseline reading away from RF interference.
  * Direct Sun Detection Test: Confirmed signal jump (from 3.5 baseline up to 45.0 peak) 
    when aimed directly at the Sun, validating 1000 SFU scaling logic.
- Web Dashboard Testing:
  * Cross-Browser Testing: Verified UI/WebSocket functionality on Chrome and Edge.
  * Performance Testing: Confirmed smooth 10 Hz data streaming without browser lag.
  * Recovery Testing: Verified automatic error handling and connection status updates upon disconnect.


8. FUTURE DEVELOPMENT
---------------------
- Multi-Dish Antenna Array for increased signal gain and target precision.
- Faraday Shielding & Thermal Insulation to minimize environmental temperature drift.
- Direct Cloud Integration with AWS, GCP, or Azure for wireless remote monitoring.
- Big Data Warehouse creation for long-term historical solar flux research.
- Machine Learning implementation for automated solar flare forecasting.
================================================================================