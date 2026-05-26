import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { height } = Dimensions.get("window");

interface AnalyzeProps {
  apiUrl: string;
  onBack: () => void;
  session: any;
  isGuest: boolean;
}

export const Analyze: React.FC<AnalyzeProps> = ({
  apiUrl,
  onBack,
  session,
  isGuest,
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleImagePicker = async (useCamera: boolean) => {
    let res;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted")
        return Alert.alert("Hata", "Kamera izni gerekli");
      res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    } else {
      res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    }
    if (!res.canceled) {
      setImage(res.assets[0].uri);
      setResult(null);
    }
  };

  const startAnalysis = async () => {
    if (!image) return;
    setLoading(true);
    const formData = new FormData();
    const filename = image.split("/").pop() || "photo.jpg";
    formData.append("file", {
      uri: image,
      name: filename,
      type: "image/jpeg",
    } as any);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = await response.json();

      if (data.status === "success") {
        setResult(data);

        // --- BULUT VERİTABANINA AKILLI MÜHÜRLEME ---
        if (!isGuest && session?.user) {
          const { error } = await supabase.from("analysis_history").insert({
            user_id: session.user.id,
            total_calories: data.total_calories,
            detections: data.detections, // API'den gelen protein, carbs, fat dizisi buraya yazılıyor
            ai_advice: data.ai_advice,
            image_url: image,
          });

          if (error) console.log("⚠️ Supabase Kayıt Hatası:", error.message);
          else console.log("✅ Analiz geçmişi başarıyla kaydedildi!");
        }
      }
    } catch (e) {
      Alert.alert("Hata", "Sunucu bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Üst Navigasyon Çubuğu */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Ana Sayfa</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isGuest ? "Misafir Analizi" : "Yemek Analiz Ekranı"}
          </Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Görsel Önizleme Alanı */}
        <View style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={{ color: "#94a3b8", fontSize: 15 }}>
                🥗 Lütfen bir fotoğraf yükleyin
              </Text>
            </View>
          )}
        </View>

        {/* Aksiyon Seçim Butonları */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleImagePicker(true)}
          >
            <Text style={styles.btnLabel}>📸 Kamera Aç</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleImagePicker(false)}
          >
            <Text style={styles.btnLabel}>🖼️ Galeriden Seç</Text>
          </TouchableOpacity>
        </View>

        {/* Sonuç Kartları Bloğu */}
        {result && (
          <View style={styles.resultBox}>
            <View style={styles.totalBadge}>
              <Text style={styles.totalKcal}>{result.total_calories}</Text>
              <Text style={styles.kcalLabel}>TOPLAM KALORİ (KCAL)</Text>
            </View>

            {result.detections.map((d: any, i: number) => (
              <View key={i} style={styles.foodCard}>
                <View>
                  <Text style={styles.foodName}>🍲 {d.label}</Text>
                  <Text style={styles.foodMacros}>
                    P: {d.protein}g | K: {d.carbs}g | Y: {d.fat}g
                  </Text>
                </View>
                <Text style={styles.foodKcal}>{d.calories} kcal</Text>
              </View>
            ))}

            {result.ai_advice && (
              <View style={styles.aiAdviceCard}>
                <Text style={styles.aiTitle}>✨ DeepDiet AI Diyet Analizi</Text>
                <Text style={styles.aiContent}>{result.ai_advice}</Text>
              </View>
            )}
          </View>
        )}

        {image && !loading && (
          <TouchableOpacity style={styles.analyzeBtn} onPress={startAnalysis}>
            <Text style={styles.analyzeText}>Şimdi Analiz Et</Text>
          </TouchableOpacity>
        )}

        {loading && (
          <ActivityIndicator
            size="large"
            color="#2E7D32"
            style={{ marginTop: 20 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: "#F4F7F4" },
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 50 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFF",
    borderRadius: 12,
    elevation: 1,
  },
  backText: { color: "#2E7D32", fontSize: 14, fontWeight: "bold" },
  headerTitle: { color: "#1e293b", fontSize: 16, fontWeight: "bold" },
  imageContainer: {
    height: height * 0.35,
    backgroundColor: "#FFF",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  actionBtn: {
    flex: 0.48,
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.02,
  },
  btnLabel: { color: "#334155", fontWeight: "bold", fontSize: 14 },
  analyzeBtn: {
    backgroundColor: "#2E7D32",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    elevation: 3,
  },
  analyzeText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  resultBox: { marginBottom: 20 },
  totalBadge: {
    backgroundColor: "#E8F5E9",
    padding: 20,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },
  totalKcal: { color: "#2E7D32", fontSize: 44, fontWeight: "900" },
  kcalLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  foodCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderLeftWidth: 5,
    borderLeftColor: "#2E7D32",
    elevation: 1,
  },
  foodName: { color: "#1e293b", fontSize: 16, fontWeight: "bold" },
  foodMacros: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  foodKcal: { color: "#2E7D32", fontWeight: "bold", fontSize: 16 },
  aiAdviceCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
  },
  aiTitle: {
    color: "#2E7D32",
    fontWeight: "bold",
    marginBottom: 10,
    fontSize: 15,
  },
  aiContent: {
    color: "#475569",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 22,
  },
});

export default Analyze;
