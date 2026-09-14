import os
from typing import List
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise RuntimeError('OPENAI_API_KEY is not configured. Create backend/.env')
client = OpenAI(api_key=api_key)
app = FastAPI(title='My AI Chatbot', version='1.0')
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

class Message(BaseModel):
    role: str
    content: str
class ChatRequest(BaseModel):
    messages: List[Message]

@app.get('/')
def root():
    return {'message': 'My AI Chatbot API is running'}

@app.post('/chat')
def chat(request: ChatRequest):
    response = client.responses.create(
        model=os.getenv('OPENAI_MODEL', 'gpt-5.6-luna'),
        instructions='''You are a helpful AI assistant. Give clear, accurate and useful answers. Use Markdown when appropriate. When explaining technical topics, start simply, give examples, and explain complicated concepts step by step. Do not claim to have performed actions you did not perform.''',
        input=[{'role': m.role, 'content': m.content} for m in request.messages]
    )
    return {'response': response.output_text}
