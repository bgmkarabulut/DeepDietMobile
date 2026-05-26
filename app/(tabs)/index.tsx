import { supabase } from "@/lib/supabase";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import Analyze from "../components/Analyze";
import BottomBar from "../components/BottomBar";
import HomeScreen from "../components/Home";
import ProfileScreen from "../components/Profile";
import ProgressScreen from "../components/Progress"; // 🌟 Yeni oluşturduğun canavar Progress bileşenini içeri aldık!
import Welcome from "../components/Welcome";

const API_URL = "http://192.168.1.5:8000/analyze"; // Ev IP Adresin

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ekran ve Sekme Yönlendirme State'leri
  const [currentScreen, setCurrentScreen] = useState<
    "welcome" | "app" | "analyze"
  >("welcome");
  const [activeTab, setActiveTab] = useState<"home" | "history" | "profile">(
    "home",
  );

  useEffect(() => {
    // 1. Cihaz hafızasındaki eski oturumu oku
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (initSession) {
        setSession(initSession);
        setIsGuest(false);
        setCurrentScreen("app");
      }
      setLoading(false);
    });

    // 2. Dinleyici: Oturum durumunu yakalar
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === "SIGNED_IN" && currentSession) {
        setSession(currentSession);
        setIsGuest(false);

        // Kayıtlı kullanıcıyı veritabanındaki ana kullanıcılar tablosuna mühürle
        await supabase.from("users").upsert({
          id: currentSession.user.id,
          email: currentSession.user.email,
          full_name: currentSession.user.email?.split("@")[0],
          last_login: new Date().toISOString(),
        });
      } else if (event === "SIGNED_OUT") {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // MİSAFİR GİRİŞİ: 'guest_entries' tablosuna tam uyumlu
  const handleGuestSignIn = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("guest_entries")
        .insert([{ device_info: "Expo Guest Session" }]);

      if (error) {
        console.log(
          "⚠️ Guest entries tablosuna yazılırken hata çıktı:",
          error.message,
        );
      } else {
        console.log(
          "✅ Misafir girişi guest_entries tablosuna başarıyla loglandı!",
        );
      }

      setIsGuest(true);
      setSession(null); // Misafirin bulut oturumu olmaz, null kilitliyoruz
      setActiveTab("home");
      setCurrentScreen("app");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Çıkış yapma akışı
  const handleSignOut = async () => {
    if (!isGuest) {
      await supabase.auth.signOut();
    }
    setIsGuest(false);
    setSession(null);
    setCurrentScreen("welcome");
    setActiveTab("home");
  };

  // MİSAFİR KİLİDİ: Misafirlerin Profile ve History sayfalarını görmesini engeller
  const handleTabChange = (targetTab: "home" | "history" | "profile") => {
    if (isGuest && (targetTab === "history" || targetTab === "profile")) {
      Alert.alert(
        "Kısıtlı Alan 🔒",
        "Profil ve geçmiş takibi özelliklerini kullanabilmek için lütfen ücretsiz hesap oluşturun.",
        [
          { text: "Kapat", style: "cancel" },
          { text: "Kayıt Ol / Giriş Yap", onPress: () => handleSignOut() },
        ],
      );
      return;
    }
    setActiveTab(targetTab);
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  // KAMERA / ANALİZ KATMANI
  if (currentScreen === "analyze") {
    return (
      <Analyze
        apiUrl={API_URL}
        session={session}
        isGuest={isGuest}
        onBack={() => setCurrentScreen("app")}
      />
    );
  }

  // WELCOME GİRİŞ KATMANI
  if (currentScreen === "welcome") {
    return (
      <Welcome
        onStart={(userSession) => {
          setSession(userSession);
          setIsGuest(false);
          setCurrentScreen("app");
        }}
        onGuest={handleGuestSignIn}
      />
    );
  }

  // ANA UYGULAMA KATMANI
  return (
    <SafeAreaView style={styles.appContainer}>
      <View style={styles.contentWrapper}>
        {activeTab === "home" && (
          <HomeScreen
            session={session}
            isGuest={isGuest}
            onNavigateToAnalyze={() => setCurrentScreen("analyze")}
            onSignOut={handleSignOut}
          />
        )}

        {/* 🌟 GERÇEK PROGRESS EKRANI BAĞLANTISI */}
        {activeTab === "history" && !isGuest && (
          <ProgressScreen session={session} />
        )}

        {activeTab === "profile" && !isGuest && (
          <ProfileScreen
            session={session}
            isGuest={isGuest}
            onSignOut={handleSignOut}
          />
        )}
      </View>

      {/* Alt Gezinti Çubuğu */}
      <BottomBar activeTab={activeTab} setActiveTab={handleTabChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    flex: 1,
    backgroundColor: "#F4F7F4",
    justifyContent: "center",
    alignItems: "center",
  },
  appContainer: { flex: 1, backgroundColor: "#F4F7F4" },
  contentWrapper: { flex: 1, paddingBottom: 75 },
});
