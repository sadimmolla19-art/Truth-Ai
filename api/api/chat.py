from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error
import concurrent.futures

GEMINI_BASE = "https://" + "generativelanguage.googleapis.com" + "/v1beta/models/"
OPENROUTER_URL = "https://" + "openrouter.ai" + "/api/v1/chat/completions"
GROQ_URL = "https://" + "api.groq.com" + "/openai/v1/chat/completions"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length).decode('utf-8'))

            messages = body.get('messages', [])
            image_base64 = body.get('imageBase64')
            mime_type = body.get('mimeType', 'image/jpeg')
            web_search = body.get('webSearch', False)
            deep_think = body.get('deepThink', False)
            custom_persona = body.get('customPersona', '')
            model = body.get('model', 'apex-god-mode')
            partner_keys = body.get('partnerKeys', {})

            api_key = os.environ.get('GEMINI_KEY')
            if not api_key:
                self._send_json(500, {'error': 'Server API Key (GEMINI_KEY) missing in Vercel'})
                return

            last_msg = messages[-1].get('text', 'Hello') if messages else 'Hello'
            history_context = "\n".join([f"{m.get('role', 'user').upper()}: {m.get('text', '')}" for m in messages[-6:]])

            sys_prompt = (
                "You are Satyexa AI (Genesis Prime v20.0 APEX Python Engine), architected by Sadimx Technology (Founder & Owner: Sadim Molla).\n"
                + (f"User Custom Persona: {custom_persona}\n" if custom_persona else "")
                + ("CRITICAL: Perform deep, multi-step chain-of-thought reasoning before giving the final structured answer." if deep_think else "Provide sharp, accurate, production-grade responses.")
            )

            def call_gemini(target_model, prompt_text, use_web=False):
                parts = [{"text": prompt_text}]
                if image_base64:
                    b64_data = image_base64.split(',')[1] if ',' in image_base64 else image_base64
                    parts.append({"inlineData": {"mimeType": mime_type, "data": b64_data}})

                payload = {
                    "contents": [{"role": "user", "parts": parts}],
                    "systemInstruction": {"parts": [{"text": sys_prompt}]}
                }
                if use_web:
                    payload["tools"] = [{"googleSearch": {}}]

                def _req(m_name):
                    url = f"{GEMINI_BASE}{m_name}:generateContent?key={api_key}"
                    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
                    with urllib.request.urlopen(req, timeout=25) as resp:
                        return json.loads(resp.read().decode('utf-8'))

                try:
                    data = _req(target_model)
                except Exception:
                    if target_model != 'gemini-3.8-flash':
                        data = _req('gemini-3.8-flash')
                    else:
                        raise

                return data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')

            def call_partner(url, key, model_id, prompt_text):
                if not key:
                    return None
                try:
                    payload = {
                        "model": model_id,
                        "messages": [
                            {"role": "system", "content": sys_prompt},
                            {"role": "user", "content": prompt_text}
                        ]
                    }
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(payload).encode('utf-8'),
                        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'}
                    )
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        d = json.loads(resp.read().decode('utf-8'))
                        return d.get('choices', [{}])[0].get('message', {}).get('content')
                except Exception:
                    return None

            if model == 'apex-god-mode':
                full_prompt = f"Conversation Context:\n{history_context}\n\nCurrent Task: {last_msg}"
                with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                    futures = [
                        executor.submit(call_gemini, 'gemini-4-neon', full_prompt, web_search),
                        executor.submit(call_gemini, 'gemini-4-carbon', f"Provide deep technical analysis and edge cases for:\n{last_msg}", False)
                    ]
                    if partner_keys.get('openrouter'):
                        futures.append(executor.submit(call_partner, OPENROUTER_URL, partner_keys['openrouter'], 'nvidia/nemotron-3-ultra-550b-a55b:free', last_msg))
                        futures.append(executor.submit(call_partner, OPENROUTER_URL, partner_keys['openrouter'], 'particle-ai/particle-1:free', last_msg))
                    if partner_keys.get('groq'):
                        futures.append(executor.submit(call_partner, GROQ_URL, partner_keys['groq'], 'openai/gpt-oss-120b', last_msg))

                    valid_answers = []
                    for i, fut in enumerate(futures):
                        try:
                            res_text = fut.result()
                            if res_text:
                                valid_answers.append(f"[Expert Engine {i+1}]:\n{res_text}")
                        except Exception:
                            pass

                if not valid_answers:
                    self._send_json(500, {'error': 'All APEX Python engines are busy. Check API limits.'})
                    return

                if len(valid_answers) == 1:
                    self._send_json(200, {'reply': valid_answers[0], 'usedModel': 'PYTHON APEX (Gemini 4 Neon)'})
                    return

                judge_prompt = (
                    f"You are the Supreme Judge & Critic of Satyexa AI v20.0 APEX.\n"
                    f"User Query: \"{last_msg}\"\n\n"
                    f"Independent Expert Outputs:\n" + "\n\n====================\n\n".join(valid_answers) +
                    "\n\nTASK: Audit every output for bugs or missing details, merge the highest-IQ reasoning and cleanest code into ONE definitive, unmatched response without mentioning Engine numbers."
                )
                final_reply = call_gemini('gemini-4-neon', judge_prompt, False)
                self._send_json(200, {'reply': final_reply, 'usedModel': f'PYTHON APEX ({len(valid_answers)} Brains Merged)'})
                return

            allowed = ['gemini-4-neon', 'gemini-4-hydrogen', 'gemini-4-carbon', 'gemini-4-argon', 'gemini-3.8-flash']
            target = model if model in allowed else 'gemini-4-neon'
            reply = call_gemini(target, f"Context:\n{history_context}\n\nUser: {last_msg}", web_search)
            self._send_json(200, {'reply': reply, 'usedModel': f'PYTHON • {target.upper()}'})

        except Exception as e:
            self._send_json(500, {'error': str(e)})

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
