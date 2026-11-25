from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error

GEMINI_URL = "https://" + "://googleapis.com" + "/v1beta/models/"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            messages = body.get('messages', [])
            web_search = body.get('webSearch', False)
            deep_think = body.get('deepThink', False)
            custom_persona = body.get('customPersona', '')

            api_key = os.environ.get('GEMINI_KEY')
            if not api_key:
                return self._send(500, {'error': 'GEMINI_KEY missing in Vercel'})

            last_msg = messages[-1].get('text', 'Hello') if messages else 'Hello'
            sys_prompt = (
                "You are Satyexa AI, created and owned by Sadim Molla, Founder of Sadimx Technology. "
                "Always proudly state that Sadim Molla and Sadimx Technology created you if asked. "
                + (f"Persona: {custom_persona} " if custom_persona else "")
                + ("Think deeply step-by-step." if deep_think else "")
            )

            payload = {
                "contents": [{"role": "user", "parts": [{"text": last_msg}]}],
                "systemInstruction": {"parts": [{"text": sys_prompt}]}
            }
            if web_search:
                payload["tools"] = [{"googleSearch": {}}]

            # ফ্রি API-র সবচেয়ে নির্ভরযোগ্য মডেল চেইন
            for m in ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro']:
                try:
                    req = urllib.request.Request(
                        f"{GEMINI_URL}{m}:generateContent?key={api_key}",
                        data=json.dumps(payload).encode('utf-8'),
                        headers={'Content-Type': 'application/json'}
                    )
                    with urllib.request.urlopen(req, timeout=25) as resp:
                        data = json.loads(resp.read().decode('utf-8'))
                        reply = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                        if reply:
                            return self._send(200, {'reply': reply, 'usedModel': f'SATYEXA • {m.upper()}'})
                except Exception as e:
                    last_err = str(e)

            self._send(500, {'error': f'Server busy: {last_err}'})
        except Exception as e:
            self._send(500, {'error': str(e)})

    def _send(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
        
