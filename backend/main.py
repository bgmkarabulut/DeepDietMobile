import os
from groq import Groq
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
from torchvision.models.detection import fasterrcnn_resnet50_fpn
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor 
from torchvision.transforms import functional as F
import torchvision.ops as ops
from PIL import Image
import io
import logging
from dotenv import load_dotenv

# 🌟 Proje dizinindeki .env dosyasını Python'a yükle
load_dotenv()

# npx expo start 
# python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 🌟 Çevre değişkeninden veya fallback olarak Expo isminden güvenle oku
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("EXPO_PUBLIC_GROQ_API_KEY")

if not GROQ_API_KEY:
    print("⚠️ Hata: Backend .env dosyasında GROQ_API_KEY bulunamadı!")

groq_client = Groq(api_key=GROQ_API_KEY)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FOOD_MAP = {
    0: "baklagil", 1: "ekmek", 2: "pilav", 3: "kirmizi et", 4: "salata",
    5: "balik", 6: "patates", 7: "tavuk", 8: "sebze", 9: "makarna",
    10: "corba", 11: "zeytinyagli", 12: "yumurta", 13: "yogurt",
    14: "meyve", 15: "manti", 16: "pide", 17: "fastfood", 18: "lahmacun", 19: "tatli"
}

PORTION_G = { k: v for k, v in zip(FOOD_MAP.values(), [91, 40, 170, 150, 300, 200, 80, 250, 100, 90, 150, 150, 50, 160, 120, 100, 170, 190, 150, 160]) }
KCAL_PER_100G = { k: v for k, v in zip(FOOD_MAP.values(), [340, 265, 130, 250, 15, 200, 77, 165, 65, 131, 50, 120, 155, 60, 52, 180, 250, 295, 200, 300]) }
IMG_SIZE = 512 # best_food_model.pth modeli 512x512 boyutunda eğitildiği için bu boyutu kullanıyoruz 

def get_ai_advice(detections, total_kcal):
    if not detections: return ""
    
    foods = ", ".join([d['label'] for d in detections])
    prompt = f"""
    Sen uzman bir diyetisyensin. Kullanıcının öğünü: {foods}. 
    Toplam kalori: {total_kcal} kcal. 
    Bu öğünü besin dengesi açısından 2 kısa cümleyle yorumla ve bir tavsiye ver. Samimi bir dil kullan.
    """
    
    try:
        # En güncel ve stabil model olan llama-3.3-70b-versatile kullanıyoruz
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile", 
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        logger.error(f"LLM Hatası: {e}")
        return "Afiyet olsun! Bugün dengeli beslenmeye harika bir adım attın."

def load_model():
    model = fasterrcnn_resnet50_fpn(weights=None)
    model.roi_heads.box_predictor = FastRCNNPredictor(model.roi_heads.box_predictor.cls_score.in_features, 21)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.load_state_dict(torch.load("models/best_food_model.pth", map_location=device))
    return model.to(device).eval(), device

model, device = load_model()

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
        image = image.resize((IMG_SIZE, IMG_SIZE)) #IMG_SIZE ile yeniden boyutlandırma
        img_tensor = F.to_tensor(image).unsqueeze(0).to(device)
        with torch.no_grad():
            results = model(img_tensor)

        boxes, scores, labels = results[0]['boxes'], results[0]['scores'], results[0]['labels']
        keep = ops.nms(boxes, scores, 0.3)
        
        detections = []
        for i in keep:
            if scores[i] > 0.40:
                name = FOOD_MAP.get(int(labels[i]) - 1, "Bilinmeyen")
                box = boxes[i].detach().cpu().numpy()
                area_ratio = ((box[2]-box[0])*(box[3]-box[1])) / (416*416)
                kcal = round((PORTION_G.get(name, 150) * max(0.3, min(area_ratio/0.2, 3.0)) / 100) * KCAL_PER_100G.get(name, 150))
                detections.append({"label": name.capitalize(), "calories": kcal, "confidence": float(scores[i])})

        total_kcal = sum(d['calories'] for d in detections)
        advice = get_ai_advice(detections, total_kcal)
        
        return {"status": "success", "detections": detections, "total_calories": total_kcal, "ai_advice": advice}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)