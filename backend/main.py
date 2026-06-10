import os
import io
import json
import torch
import logging
import numpy as np
from PIL import Image
from groq import Groq
from dotenv import load_dotenv
from datetime import date

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware

from torchvision.models.detection import (
    fasterrcnn_resnet50_fpn,
    FasterRCNN_ResNet50_FPN_Weights
)
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.transforms import functional as F
import torchvision.ops as ops

from supabase import create_client

# ---------------- ENV ----------------
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- APP ----------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- FOOD MAP ----------------
FOOD_MAP = {
    0: "baklagil", 1: "ekmek", 2: "pilav", 3: "kirmizi et", 4: "salata",
    5: "balik", 6: "patates", 7: "tavuk", 8: "sebze", 9: "makarna",
    10: "corba", 11: "zeytinyagli", 12: "yumurta", 13: "yogurt",
    14: "meyve", 15: "manti", 16: "pide", 17: "fastfood",
    18: "lahmacun", 19: "tatli"
}

FOOD_MAP_EN = {v: v.capitalize() for v in FOOD_MAP.values()}

# ---------------- MODEL ----------------


def load_model():
    NUM_CLASSES = 21

    model = fasterrcnn_resnet50_fpn(
        weights=FasterRCNN_ResNet50_FPN_Weights.DEFAULT
    )

    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, NUM_CLASSES)

    model.roi_heads.score_thresh = 0.25
    model.roi_heads.nms_thresh = 0.30

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model.load_state_dict(
        torch.load("models/modelfoodplus3.pth", map_location=device)
    )

    model.to(device)
    model.eval()

    return model, device


model, device = load_model()

# ---------------- CALORIES ----------------


def estimate_calories(class_id, box, img_size=512):
    food_name = FOOD_MAP.get(class_id, "unknown")

    x1, y1, x2, y2 = box

    area = max(1, (x2 - x1) * (y2 - y1))
    ratio = area / (img_size * img_size)

    base_portion = 150
    weight = base_portion * np.clip(np.sqrt(ratio / 0.12), 0.7, 1.4)

    kcal = weight * 1.6
    protein = weight * 0.08
    carbs = weight * 0.2
    fat = weight * 0.05

    return {
        "food": food_name,
        "weight": round(weight, 1),
        "kcal": round(kcal, 1),
        "protein": round(protein, 1),
        "carb": round(carbs, 1),
        "fat": round(fat, 1)
    }

# ---------------- AI ADVICE ----------------


def get_ai_advice(detections, total_kcal, language="en"):
    food_list = ", ".join(
        [f"{d['label']} ({d['protein']}P {d['carbs']}C {d['fat']}F)" for d in detections]
    )

    prompt = f"""
Meal: {food_list}
Total kcal: {total_kcal}

Give short 2-sentence nutrition advice in {language}.
"""

    try:
        chat = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )
        return chat.choices[0].message.content
    except:
        return "Meal looks balanced."

# ---------------- ANALYZE ----------------


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), language: str = Form("en")):

    image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    image = image.resize((512, 512))

    tensor = F.to_tensor(image).to(device)

    with torch.no_grad():
        outputs = model([tensor])[0]

    keep = ops.nms(outputs["boxes"], outputs["scores"], 0.3)

    detections = []

    for i in keep:
        score = float(outputs["scores"][i])
        if score < 0.3:
            continue

        class_id = int(outputs["labels"][i]) - 1
        if class_id not in FOOD_MAP:
            continue

        box = outputs["boxes"][i].cpu().numpy()

        nutrition = estimate_calories(class_id, box, 512)

        detections.append({
            "label": FOOD_MAP_EN.get(nutrition["food"], nutrition["food"]),
            "weight": nutrition["weight"],
            "calories": nutrition["kcal"],
            "protein": nutrition["protein"],
            "carbs": nutrition["carb"],
            "fat": nutrition["fat"],
            "confidence": round(score, 3)
        })

    total_kcal = sum(d["calories"] for d in detections)
    total_protein = sum(d["protein"] for d in detections)
    total_carbs = sum(d["carbs"] for d in detections)
    total_fat = sum(d["fat"] for d in detections)

    advice = get_ai_advice(detections, total_kcal, language)

    return {
        "status": "success",
        "detections": detections,
        "total_calories": total_kcal,
        "total_protein": total_protein,
        "total_carbs": total_carbs,
        "total_fat": total_fat,
        "food_count": len(detections),
        "ai_advice": advice
    }

# ---------------- AI COACH (SUPABASE FIXED) ----------------


@app.post("/ai/coach")
async def ai_coach(payload: dict):
    try:
        print("AI COACH HIT")
        user_id = payload.get("user_id")
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not SUPABASE_URL or not SUPABASE_KEY:
            return {"response": "Missing Supabase env vars"}
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        today = date.today().strftime("%Y-%m-%d")
        # DAILY
        daily = supabase.table("daily_logs") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("date", today) \
            .execute()

        daily_data = daily.data[0] if daily.data else {}

        # HISTORY
        history = supabase.table("analysis_history") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()

        # TARGETS
        targets = supabase.table("targets") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()

        targets_data = targets.data[0] if targets.data else {}

        prompt = f"""
        You are a nutrition coach.

        User targets:
        {targets_data}

        Today's log:
        {daily_data}

        Meal history:
        {history.data}

        Give:
        - short summary
        - calorie analysis
        - protein feedback
        - hydration feedback based on water_intake
        - 3 tips

        Keep it short.
        """

        chat = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )

        return {
            "response": chat.choices[0].message.content
        }

    except Exception as e:
        print("ERROR:", e)
    return {"response": str(e)}

# ---------------- RUN ----------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
