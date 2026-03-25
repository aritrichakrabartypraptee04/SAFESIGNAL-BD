import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationMap } from './components/NavigationMap';
import { ForecastEngine } from './components/ForecastEngine';
import { 
  AlertTriangle, 
  Droplets, 
  Thermometer, 
  Wind, 
  MapPin, 
  Smartphone, 
  Radio, 
  ShieldAlert,
  CloudRain,
  Waves,
  Mountain,
  Upload,
  Database,
  User as UserIcon,
  LayoutGrid,
  LogOut,
  ChevronRight,
  ChevronDown,
  Phone,
  Mail,
  Lock,
  Users,
  CheckCircle2,
  Star,
  Navigation,
  LifeBuoy,
  PhoneCall,
  Settings,
  Bell,
  Languages,
  Accessibility,
  Activity,
  Map as MapIcon,
  PlusCircle,
  History,
  Info,
  BrainCircuit,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Cpu,
  Plus,
  Minus,
  Target,
  Layers,
  User,
  Search,
  Zap,
  Clock,
  Globe,
  Home,
  X,
  Check,
  RefreshCw
} from 'lucide-react';
import { analyzeRisk, translateToDialect, fetchWeatherWithAI } from './services/geminiService';
import { BANGLADESH_REGIONS, SHELTERS, EMERGENCY_CONTACTS } from './constants';
import { AlertData, RegionData, Dialect, DialectTranslation, UserProfile, BMBData, BWDBData, FFWCData, DAEData, CPPData, Language, VulnerabilityIndicator, RiskLevel } from './types';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';
import FeedbackSystem from './components/FeedbackSystem';
import FalseAlertReport from './components/FalseAlertReport';
import { Toaster, toast } from 'sonner';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  onSnapshot
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 23.6850,
  lng: 90.3563
};

const NAV_ITEMS = [
  { id: 'app', icon: Activity, label: 'Dashboard', description: 'Real-time monitoring & alerts' },
  { id: 'map', icon: MapIcon, label: 'Hazard Map', description: 'Interactive risk visualization' },
  { id: 'sos', icon: LifeBuoy, label: 'SOS Support', description: 'Emergency response & mesh relay' },
  { id: 'community', icon: Users, label: 'Community', description: 'Volunteer network & ground reality' },
  { id: 'datacenter', icon: Database, label: 'Data Center', description: 'Telemetry uplink & analysis' },
  { id: 'history', icon: History, label: 'History', description: 'Past alerts & event logs' },
  { id: 'admin', icon: ShieldCheck, label: 'Admin', description: 'Command & control center', adminOnly: true },
  { id: 'settings', icon: Settings, label: 'Settings', description: 'System configuration' },
];

export default function App() {
  const [selectedRegion, setSelectedRegion] = useState<RegionData>(BANGLADESH_REGIONS[0]);
  const [regions, setRegions] = useState<RegionData[]>(BANGLADESH_REGIONS);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'regions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreData: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        firestoreData[doc.id] = doc.data();
      });

      const updatedRegions = BANGLADESH_REGIONS.map(r => {
        const id = r.name.toLowerCase().replace(/\s+/g, '-');
        const fsData = firestoreData[id];
        if (fsData) {
          return {
            ...r,
            risk_level: fsData.risk_level || r.risk_level,
            current_rainfall: fsData.current_rainfall ?? r.current_rainfall,
            current_temp: fsData.current_temp ?? r.current_temp,
            lastUpdated: fsData.lastUpdated
          };
        }
        return r;
      });
      setRegions(updatedRegions);
    });
    return () => unsubscribe();
  }, []);

  const syncWeather = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/admin/sync-weather', { method: 'POST' });
      if (response.ok) {
        toast.success("Weather sync initiated for all 64 districts.");
      } else {
        toast.error("Failed to initiate weather sync.");
      }
    } catch (error) {
      console.error("Sync Error:", error);
      toast.error("Network error during weather sync.");
    } finally {
      setIsSyncing(false);
    }
  };

  const currentRegionData = regions.find(r => r.id === selectedRegion.id) || selectedRegion;

  const [alert, setAlert] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'app' | 'sms' | 'technical' | 'dialect' | 'profile' | 'datacenter' | 'auth' | 'districts' | 'map' | 'sos' | 'admin' | 'history' | 'settings' | 'community'>('app');
  const [alertTab, setAlertTab] = useState<'app' | 'sms' | 'technical' | 'dialect'>('app');
  const [selectedDialect, setSelectedDialect] = useState<Dialect>('Standard');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English');
  const [dialectTranslation, setDialectTranslation] = useState<DialectTranslation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [selectedAlertForFeedback, setSelectedAlertForFeedback] = useState<string | null>(null);
  const [selectedAlertForReport, setSelectedAlertForReport] = useState<string | null>(null);
  const [isReportingFalse, setIsReportingFalse] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [discoveredNodes, setDiscoveredNodes] = useState<string[]>([]);

  const toggleBluetoothMesh = async () => {
    if (!bluetoothEnabled) {
      try {
        // Simulation of Bluetooth discovery
        setBluetoothEnabled(true);
        toast.success("Bluetooth Mesh Activated", {
          description: "Searching for nearby SafeSignal nodes for offline relay..."
        });
        
        // Simulate finding nodes
        setTimeout(() => {
          setDiscoveredNodes(['Node_A72', 'Node_B91', 'Node_X04']);
        }, 2000);
      } catch (err) {
        toast.error("Bluetooth Error", { description: "Hardware interface not accessible." });
      }
    } else {
      setBluetoothEnabled(false);
      setDiscoveredNodes([]);
    }
  };
  const [activeAlerts, setActiveAlerts] = useState<AlertData[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back Online", { description: "Syncing latest hazard data..." });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Offline Mode", { description: "Using cached data. Mesh network active." });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persistence logic
  useEffect(() => {
    if (activeAlerts.length > 0) {
      localStorage.setItem('cached_alerts', JSON.stringify(activeAlerts));
    }
  }, [activeAlerts]);

  useEffect(() => {
    const cached = localStorage.getItem('cached_alerts');
    if (cached && activeAlerts.length === 0) {
      setActiveAlerts(JSON.parse(cached));
    }
  }, []);

  // Sidebar State
  const [sidebarMode, setSidebarMode] = useState<'alphabetical' | 'disaster'>('alphabetical');
  const [expandedHazards, setExpandedHazards] = useState<string[]>(['Flood', 'Cyclone']);

  // Data Center State
  const [uploadType, setUploadType] = useState<'bmb' | 'bwdb' | 'ffwc' | 'dae' | 'cpp'>('bmb');
  const [uploadData, setUploadData] = useState({
    temp: '',
    rain: '',
    water: '',
    humidity: '',
    discharge: '',
    dangerLevel: '',
    forecast24h: '',
    forecast48h: '',
    forecast72h: '',
    cropType: '',
    soilMoisture: '',
    damageArea: '',
    advice_en: '',
    advice_bn: '',
    signalLevel: '',
    volunteersActive: '',
    evacuationProgress: ''
  });
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [historicalBMBData, setHistoricalBMBData] = useState<BMBData[]>([]);
  const [historicalBWDBData, setHistoricalBWDBData] = useState<BWDBData[]>([]);
  const [historicalFFWCData, setHistoricalFFWCData] = useState<FFWCData[]>([]);
  const [historicalDAEData, setHistoricalDAEData] = useState<DAEData[]>([]);
  const [historicalCPPData, setHistoricalCPPData] = useState<CPPData[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [falseAlertCount, setFalseAlertCount] = useState(0);
  const [isRetraining, setIsRetraining] = useState(false);
  const [lastRetrained, setLastRetrained] = useState<string | null>(null);
  const [communityFeedback, setCommunityFeedback] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [mobileRotationMode, setMobileRotationMode] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dataCenterTab, setDataCenterTab] = useState<'telemetry' | 'feedback'>('telemetry');
  const [feedbackStats, setFeedbackStats] = useState({
    avgAccuracy: 0,
    avgUsefulness: 0,
    totalFeedback: 0
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (userProfile) {
      setMobileRotationMode(userProfile.mobileRotationMode ?? isMobile);
    } else {
      setMobileRotationMode(isMobile);
    }
  }, [userProfile, isMobile]);

  // Force landscape on mobile - CANCELLED as per user request
  useEffect(() => {
    if (isMobile) {
      setMobileRotationMode(false);
    }
  }, [isMobile]);

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Admin State
  const [manualAlert, setManualAlert] = useState<Partial<AlertData>>({
    risk_level: 'Low',
    hazard_type: 'Flood',
    category: 'Early Warning',
    is_active: true
  });

  // Real-time Alerts
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isTriggeringSos, setIsTriggeringSos] = useState(false);

  const triggerSos = async () => {
    if (!user || !userProfile) {
      toast.error("Authentication Required", {
        description: "Please sign in to trigger an SOS signal."
      });
      return;
    }

    setIsTriggeringSos(true);
    try {
      const sosRef = collection(db, 'sos_alerts');
      const newSos = {
        userId: user.uid,
        userName: userProfile.displayName || user.email || 'Anonymous',
        userPhone: userProfile.phone || '',
        location: userProfile.location || { lat: 23.6850, lng: 90.3563 },
        status: 'Pending',
        timestamp: new Date().toISOString(),
        vulnerabilities: userProfile.vulnerability || []
      };
      
      try {
        await addDoc(sosRef, newSos);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'sos_alerts');
      }
      
      toast.success("SOS SIGNAL BROADCASTED", {
        description: "Emergency responders and nearby volunteers have been notified.",
        duration: 10000
      });

      // Also send SMS if phone exists
      if (userProfile.phone) {
        await sendEmergencySms(userProfile.phone, `SOS ALERT: ${userProfile.displayName} needs immediate assistance at their last known location.`);
      }
    } catch (error) {
      console.error("SOS Error:", error);
      toast.error("SOS Broadcast Failed", {
        description: "Please use the direct call helplines below."
      });
    } finally {
      setIsTriggeringSos(false);
    }
  };

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
  });

  const fetchRealTimeWeather = async (lat: number, lon: number) => {
    if (lowBandwidthMode || !isOnline) return;
    setWeatherError(null);
    try {
      const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const data = await response.json();
      if (response.ok) {
        setWeatherData(data);
      } else {
        // Fallback to AI Weather Search
        console.warn("Weather API failed, falling back to AI search:", data.error);
        const aiData = await fetchWeatherWithAI(selectedRegion.name);
        setWeatherData(aiData);
        setWeatherError("Using AI-sourced weather data (API offline)");
      }
    } catch (error) {
      console.error("Failed to fetch weather:", error);
      try {
        const aiData = await fetchWeatherWithAI(selectedRegion.name);
        setWeatherData(aiData);
        setWeatherError("Using AI-sourced weather data (Network error)");
      } catch (aiError) {
        setWeatherError("Failed to fetch weather data from all sources");
      }
    }
  };

  const sendEmergencySms = async (to: string, message: string) => {
    setIsSendingSms(true);
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      const data = await response.json();
      if (data.success) {
        console.log("Emergency SMS sent successfully!");
      } else {
        console.error("Failed to send SMS: " + data.error);
      }
    } catch (error) {
      console.error("SMS Error:", error);
    } finally {
      setIsSendingSms(false);
    }
  };

  useEffect(() => {
    if (selectedRegion) {
      fetchRealTimeWeather(selectedRegion.lat, selectedRegion.lng);
    }
  }, [selectedRegion]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedRegion) {
        fetchRealTimeWeather(selectedRegion.lat, selectedRegion.lng);
      }
    }, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [selectedRegion]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setUserProfile(data);
            setSelectedLanguage(data.language || 'English');
            setDisplayName(data.displayName || '');
            setPhone(data.phone || '');
            setVulnerabilities(data.vulnerability || []);
            setMobileRotationMode(data.mobileRotationMode ?? (window.innerWidth < 768));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), where('active', '==', true), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AlertData));
      
      // Trigger toast for new alerts
      if (alerts.length > activeAlerts.length && activeAlerts.length > 0) {
        const newAlert = alerts[0];
        toast.error(`NEW ALERT: ${newAlert.alert_msg_en}`, {
          description: newAlert.description,
          duration: 10000,
          action: {
            label: 'View Details',
            onClick: () => setViewMode('app')
          }
        });
        
        // Auto-voice for high risk
        if (newAlert.risk_level === 'High') {
          speakAlert(newAlert);
        }
      }
      
      setActiveAlerts(alerts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'alerts');
    });
    return () => unsubscribe();
  }, [activeAlerts.length]);

  useEffect(() => {
    if (userProfile?.role !== 'admin') {
      setFeedbackCount(0);
      setFalseAlertCount(0);
      return;
    }

    const qFeedback = query(collection(db, 'feedback'));
    const unsubscribeFeedback = onSnapshot(qFeedback, (snapshot) => {
      setFeedbackCount(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'feedback');
    });

    const qFalseAlerts = query(collection(db, 'false_alerts'));
    const unsubscribeFalseAlerts = onSnapshot(qFalseAlerts, (snapshot) => {
      setFalseAlertCount(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'false_alerts');
    });

    return () => {
      unsubscribeFeedback();
      unsubscribeFalseAlerts();
    };
  }, [userProfile?.role]);

  const handleRetrainModel = async () => {
    setIsRetraining(true);
    toast.info("Model Recalibration Initiated", {
      description: `Processing ${feedbackCount} feedback points and ${falseAlertCount} false alert reports...`
    });
    
    // Simulate training time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setIsRetraining(false);
    setLastRetrained(new Date().toISOString());
    toast.success("Model Training Complete", {
      description: "Hazard prediction weights updated based on community ground truth."
    });
  };

  const speakAlert = (alert: AlertData) => {
    const utterance = new SpeechSynthesisUtterance(`${alert.category}. ${alert.alert_msg_en}. ${alert.description}`);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (viewMode === 'datacenter') {
      fetchHistoricalData();
      calculateFeedbackStats();
    }
    if (viewMode === 'profile' || viewMode === 'app') {
      fetchCommunityFeedback();
    }
  }, [viewMode, selectedRegion]);

  const fetchCommunityFeedback = async () => {
    try {
      const q = query(
        collection(db, 'feedback'),
        where('regionId', '==', selectedRegion.id),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      try {
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => doc.data());
        setCommunityFeedback(data);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'feedback');
      }
    } catch (error) {
      console.error("Error fetching community feedback:", error);
    }
  };

  const calculateFeedbackStats = async () => {
    try {
      const q = query(
        collection(db, 'feedback'),
        where('regionId', '==', selectedRegion.id),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const feedbacks = querySnapshot.docs.map(doc => doc.data());
      
      if (feedbacks.length > 0) {
        const totalAccuracy = feedbacks.reduce((acc, curr) => acc + (curr.accuracy || 0), 0);
        const totalUsefulness = feedbacks.reduce((acc, curr) => acc + (curr.usefulness || 0), 0);
        
        setFeedbackStats({
          avgAccuracy: Number((totalAccuracy / feedbacks.length).toFixed(1)),
          avgUsefulness: Number((totalUsefulness / feedbacks.length).toFixed(1)),
          totalFeedback: feedbacks.length
        });
      } else {
        setFeedbackStats({ avgAccuracy: 0, avgUsefulness: 0, totalFeedback: 0 });
      }
    } catch (error) {
      console.error("Error calculating feedback stats:", error);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const qBMB = query(collection(db, 'bmb_uploads'), where('districtId', '==', selectedRegion.id), orderBy('timestamp', 'desc'), limit(15));
      const qBWDB = query(collection(db, 'bwdb_uploads'), where('districtId', '==', selectedRegion.id), orderBy('timestamp', 'desc'), limit(15));
      const qFFWC = query(collection(db, 'ffwc_uploads'), where('districtId', '==', selectedRegion.id), orderBy('timestamp', 'desc'), limit(15));
      const qDAE = query(collection(db, 'dae_uploads'), where('districtId', '==', selectedRegion.id), orderBy('timestamp', 'desc'), limit(15));
      const qCPP = query(collection(db, 'cpp_uploads'), where('districtId', '==', selectedRegion.id), orderBy('timestamp', 'desc'), limit(15));

      try {
        const [bmbSnap, bwdbSnap, ffwcSnap, daeSnap, cppSnap] = await Promise.all([
          getDocs(qBMB), getDocs(qBWDB), getDocs(qFFWC), getDocs(qDAE), getDocs(qCPP)
        ]);
        setHistoricalBMBData(bmbSnap.docs.map(doc => doc.data() as BMBData).reverse());
        setHistoricalBWDBData(bwdbSnap.docs.map(doc => doc.data() as BWDBData).reverse());
        setHistoricalFFWCData(ffwcSnap.docs.map(doc => doc.data() as FFWCData).reverse());
        setHistoricalDAEData(daeSnap.docs.map(doc => doc.data() as DAEData).reverse());
        setHistoricalCPPData(cppSnap.docs.map(doc => doc.data() as CPPData).reverse());
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'historical_data');
      }
    } catch (error) {
      console.error("Error fetching historical data:", error);
    }
  };

  const getRegionRisk = (): RiskLevel => {
    const regionAlerts = activeAlerts.filter(a => a.location === selectedRegion.name);
    if (regionAlerts.length === 0) return 'Low';
    const levels: RiskLevel[] = ['Low', 'Medium', 'High', 'Extreme'];
    let maxLevel: RiskLevel = 'Low';
    regionAlerts.forEach(a => {
      if (levels.indexOf(a.risk_level) > levels.indexOf(maxLevel)) {
        maxLevel = a.risk_level;
      }
    });
    return maxLevel;
  };

  const currentRisk = getRegionRisk();
  const highPriorityAlert = activeAlerts.find(a => (a.risk_level === 'Extreme' || a.risk_level === 'High') && a.location === selectedRegion.name);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (authMode === 'login') {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        setViewMode('app');
      } catch (error: any) {
        setAuthError(error.message);
      }
      return;
    }

    // Signup flow
    if (!showOtpStep) {
      // Simulate sending OTP
      setShowOtpStep(true);
      return;
    }

    if (otpCode !== '123456') { // Mock OTP for demo
      setAuthError('Invalid verification code. Try 123456');
      return;
    }

    setIsVerifying(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser: UserProfile = {
        uid: userCredential.user.uid,
        email,
        phone,
        displayName,
        language: selectedLanguage,
        vulnerability: vulnerabilities,
        location: detectedLocation ? { ...detectedLocation, address: selectedRegion.name } : undefined,
        role: 'user',
        createdAt: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userCredential.user.uid}`);
      }
      setUserProfile(newUser);
      setViewMode('app');
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Login Error:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setViewMode('app');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUploading(true);
    setUploadSuccess(false);
    try {
      const timestamp = new Date().toISOString();
      if (uploadType === 'bmb') {
        const data: BMBData = {
          districtId: selectedRegion.id,
          temperature: parseFloat(uploadData.temp),
          rainfall: parseFloat(uploadData.rain),
          humidity: parseFloat(uploadData.humidity),
          uploadedBy: user.uid,
          timestamp
        };
        try {
          await addDoc(collection(db, 'bmb_uploads'), data);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'bmb_uploads');
        }
      } else if (uploadType === 'bwdb') {
        const data: BWDBData = {
          districtId: selectedRegion.id,
          waterLevel: parseFloat(uploadData.water),
          uploadedBy: user.uid,
          timestamp
        };
        try {
          await addDoc(collection(db, 'bwdb_uploads'), data);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'bwdb_uploads');
        }
      } else if (uploadType === 'ffwc') {
        const data: FFWCData = {
          districtId: selectedRegion.id,
          waterLevel: parseFloat(uploadData.water),
          discharge: parseFloat(uploadData.discharge),
          dangerLevel: parseFloat(uploadData.dangerLevel),
          forecast24h: parseFloat(uploadData.forecast24h),
          forecast48h: parseFloat(uploadData.forecast48h),
          forecast72h: parseFloat(uploadData.forecast72h),
          uploadedBy: user.uid,
          timestamp
        };
        try {
          await addDoc(collection(db, 'ffwc_uploads'), data);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'ffwc_uploads');
        }
      } else if (uploadType === 'dae') {
        const data: DAEData = {
          districtId: selectedRegion.id,
          cropType: uploadData.cropType,
          soilMoisture: parseFloat(uploadData.soilMoisture),
          damageArea: parseFloat(uploadData.damageArea),
          advice_en: uploadData.advice_en,
          advice_bn: uploadData.advice_bn,
          uploadedBy: user.uid,
          timestamp
        };
        try {
          await addDoc(collection(db, 'dae_uploads'), data);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'dae_uploads');
        }
      } else if (uploadType === 'cpp') {
        const data: CPPData = {
          districtId: selectedRegion.id,
          signalLevel: parseInt(uploadData.signalLevel),
          volunteersActive: parseInt(uploadData.volunteersActive),
          evacuationProgress: parseFloat(uploadData.evacuationProgress),
          lastUpdate: timestamp,
          uploadedBy: user.uid,
          timestamp
        };
        try {
          await addDoc(collection(db, 'cpp_uploads'), data);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'cpp_uploads');
        }
      }
      setUploadSuccess(true);
      setUploadData({ 
        temp: '', rain: '', water: '', humidity: '', 
        discharge: '', dangerLevel: '', forecast24h: '', forecast48h: '', forecast72h: '',
        cropType: '', soilMoisture: '', damageArea: '', advice_en: '', advice_bn: '',
        signalLevel: '', volunteersActive: '', evacuationProgress: ''
      });
      fetchHistoricalData();
    } catch (error: any) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const toggleHazard = (hazard: string) => {
    setExpandedHazards(prev => 
      prev.includes(hazard) ? prev.filter(h => h !== hazard) : [...prev, hazard]
    );
  };

  const districtsByHazard = regions.reduce((acc, region) => {
    const hazard = region.primary_hazard;
    if (!acc[hazard]) acc[hazard] = [];
    acc[hazard].push(region);
    return acc;
  }, {} as Record<string, RegionData[]>);

  const detectLocation = () => {
    setIsDetectingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setDetectedLocation({ lat: latitude, lng: longitude });
          
          // Find closest district
          let closest = BANGLADESH_REGIONS[0];
          let minDist = Infinity;
          
          BANGLADESH_REGIONS.forEach(region => {
            const d = Math.sqrt(Math.pow(region.lat - latitude, 2) + Math.pow(region.lng - longitude, 2));
            if (d < minDist) {
              minDist = d;
              closest = region;
            }
          });
          
          setSelectedRegion(closest);
          setIsDetectingLocation(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setIsDetectingLocation(false);
        }
      );
    } else {
      setIsDetectingLocation(false);
    }
  };
  const handleAnalyze = async (region: RegionData) => {
    setLoading(true);
    try {
      const result = await analyzeRisk(region);
      setAlert(result);
      setDialectTranslation(null); // Reset translation when new alert is generated
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async (dialect: Dialect) => {
    if (!alert) return;
    setTranslating(true);
    try {
      const result = await translateToDialect(alert.alert_msg_en, dialect);
      setDialectTranslation(result);
    } catch (error) {
      console.error("Translation failed:", error);
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    handleAnalyze(selectedRegion);
  }, [selectedRegion]);

  useEffect(() => {
    if (viewMode === 'dialect' && !dialectTranslation && alert) {
      handleTranslate(selectedDialect);
    }
  }, [viewMode, selectedDialect, alert]);

  const getHazardIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'flood': return <Waves className="w-5 h-5" />;
      case 'flash flood': return <CloudRain className="w-5 h-5" />;
      case 'cyclone': return <Wind className="w-5 h-5" />;
      case 'landslide': return <Mountain className="w-5 h-5" />;
      case 'drought': return <Droplets className="w-5 h-5 opacity-50" />;
      case 'heatwave': return <Thermometer className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'bg-danger/10 text-danger border-danger/50 shadow-[0_0_20px_rgba(255,68,68,0.1)]';
      case 'medium': return 'bg-warning/10 text-warning border-warning/50 shadow-[0_0_20px_rgba(255,187,51,0.1)]';
      case 'low': return 'bg-success/10 text-success border-success/50 shadow-[0_0_20px_rgba(0,200,81,0.1)]';
      default: return 'bg-card text-muted border-line';
    }
  };

  const getTempColor = (temp: number) => {
    if (temp <= 20) return 'text-blue-400';
    if (temp <= 25) return 'text-cyan-400';
    if (temp <= 30) return 'text-success';
    if (temp <= 35) return 'text-warning';
    if (temp <= 40) return 'text-accent';
    return 'text-danger';
  };

  const getHazardColor = (hazard: string) => {
    switch (hazard) {
      case 'Flood': return 'border-blue-500/30';
      case 'Flash Flood': return 'border-cyan-500/30';
      case 'Cyclone': return 'border-purple-500/30';
      case 'Storm Surge': return 'border-teal-500/30';
      case 'Drought': return 'border-amber-500/30';
      case 'Heatwave': return 'border-orange-500/30';
      case 'Landslide': return 'border-emerald-500/30';
      default: return 'border-line';
    }
  };

  return (
    <div className={cn("min-h-screen flex flex-col")}>
      <Toaster position="top-right" theme="dark" richColors />
      {/* Header */}
      <header className="border-b border-line p-6 flex justify-between items-center bg-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3 cursor-pointer group" onClick={() => setViewMode('app')}>
              <div className="relative">
                <ShieldAlert className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full animate-pulse" />
              </div>
              <span className="bg-gradient-to-r from-white to-muted bg-clip-text text-transparent">SafeSignal BD</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
              <p className="col-header !text-[9px]">Strategic Early Warning Network // v2.5.0</p>
            </div>
          </div>
          <nav className="hidden xl:flex gap-6">
            {NAV_ITEMS.filter(item => !item.adminOnly || userProfile?.role === 'admin').map((item) => (
              <button 
                key={item.id}
                onClick={() => setViewMode(item.id as any)}
                className={cn(
                  "col-header flex items-center gap-2 transition-all relative group py-2",
                  viewMode === item.id ? "text-accent" : "hover:text-white"
                )}
              >
                <item.icon className={cn("w-3.5 h-3.5", viewMode === item.id ? "text-accent" : "text-muted group-hover:text-white")} />
                <span className="text-[10px]">{item.label}</span>
                {viewMode === item.id && (
                  <motion.div 
                    layoutId="nav-active"
                    className="absolute -bottom-8 left-0 right-0 h-0.5 bg-accent shadow-[0_0_10px_rgba(255,107,0,0.5)]"
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-6 pr-8 border-r border-line">
            <div className="text-right">
              <p className="col-header">Network Connectivity</p>
              <div className="flex items-center gap-2 justify-end">
                <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                <p className="data-value text-[10px] uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="col-header">Mesh Status</p>
              <div className="flex items-center gap-2 justify-end">
                <div className={cn("w-1.5 h-1.5 rounded-full", bluetoothEnabled ? "bg-accent animate-ping" : "bg-muted")} />
                <p className="data-value text-[10px] uppercase tracking-widest">{bluetoothEnabled ? `${discoveredNodes.length} Nodes` : 'Inactive'}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="col-header">Low Bandwidth</p>
              <button 
                onClick={() => setLowBandwidthMode(!lowBandwidthMode)}
                className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all",
                  lowBandwidthMode ? "bg-accent text-white" : "bg-muted/20 text-muted hover:bg-muted/40"
                )}
              >
                {lowBandwidthMode ? 'Active' : 'Disabled'}
              </button>
            </div>
            <div className="text-right">
              <p className="col-header">Security</p>
              <div className="data-value text-success flex items-center justify-end gap-2">
                <span className="text-[10px] font-bold">ENCRYPTED</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-success/40 rounded-full" />)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="col-header">Network Load</p>
              <p className="data-value text-accent">14.2 ms</p>
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="col-header">Operator</p>
                <p className="data-value text-xs font-bold">{userProfile?.displayName || user.email?.split('@')[0]}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setViewMode('profile')}
                  className="p-2.5 bg-card hover:bg-accent hover:text-bg transition-all rounded-lg border border-line"
                  title="Profile"
                >
                  <UserIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 bg-card hover:bg-danger hover:text-bg transition-all rounded-lg border border-line"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setViewMode('auth')}
              className="px-6 py-2.5 bg-accent text-bg font-bold text-xs uppercase tracking-widest hover:bg-white transition-all rounded-lg shadow-[0_0_20px_rgba(255,107,0,0.3)]"
            >
              Initialize Session
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] overflow-hidden">
        {/* Sidebar: Region Selection */}
        <section className="border-r border-line overflow-y-auto bg-bg/50">
          <div className="p-4 border-b border-line space-y-4 bg-bg">
            <div className="flex justify-between items-center">
              <h2 className="col-header">Monitoring Regions</h2>
              <div className="flex border border-line rounded-sm overflow-hidden">
                <button 
                  onClick={() => setSidebarMode('alphabetical')}
                  className={cn("p-1.5 transition-colors", sidebarMode === 'alphabetical' ? "bg-ink text-bg" : "hover:bg-line")}
                  title="Alphabetical View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSidebarMode('disaster')}
                  className={cn("p-1.5 transition-colors", sidebarMode === 'disaster' ? "bg-ink text-bg" : "hover:bg-line")}
                  title="Disaster View"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted group-focus-within:text-accent transition-colors" />
              <input 
                type="text"
                placeholder="Search districts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-card border border-line rounded-lg focus:border-accent outline-none font-mono text-[10px] uppercase tracking-widest transition-all"
              />
            </div>
          </div>

          {sidebarMode === 'alphabetical' ? (
            regions.filter(r => 
              r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              r.name_bn.includes(searchQuery)
            ).map((region) => (
              <div 
                key={region.id} 
                className={cn(
                  "data-row",
                  selectedRegion.id === region.id ? "bg-ink text-bg" : getHazardColor(region.primary_hazard)
                )}
                onClick={() => setSelectedRegion(region)}
              >
                <div className="flex items-center justify-center">
                  {getHazardIcon(region.primary_hazard)}
                </div>
                <div>
                  <p className="font-bold">{region.name}</p>
                  <p className="text-xs opacity-70">{region.name_bn}</p>
                </div>
                <div className="text-right">
                  <p className="col-header">Temp</p>
                  <p className={cn("data-value", getTempColor(region.current_temp))}>{region.current_temp}°C</p>
                </div>
                <div className="text-right">
                  <p className="col-header">Rain</p>
                  <p className="data-value">{region.current_rainfall}mm</p>
                  {region.lastUpdated && (
                    <p className="text-[6px] font-black uppercase tracking-widest text-muted mt-1">
                      {new Date(region.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="divide-y divide-line">
              {Object.entries(districtsByHazard).map(([hazard, districts]) => (
                <div key={hazard} className="bg-bg">
                  <button 
                    onClick={() => toggleHazard(hazard)}
                    className="w-full p-4 flex items-center justify-between hover:bg-line transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getHazardIcon(hazard)}
                      <span className="col-header opacity-100">{hazard}</span>
                      <span className="text-[10px] bg-line px-1.5 py-0.5 rounded-full">{districts.length}</span>
                    </div>
                    {expandedHazards.includes(hazard) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {expandedHazards.includes(hazard) && (
                    <div className="bg-bg/80">
                      {districts.filter(r => 
                        r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        r.name_bn.includes(searchQuery)
                      ).map((region) => (
                        <div 
                          key={region.id} 
                          className={cn(
                            "data-row pl-8",
                            selectedRegion.id === region.id ? "bg-ink text-bg" : getHazardColor(region.primary_hazard)
                          )}
                          onClick={() => setSelectedRegion(region)}
                        >
                          <div className="flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                          </div>
                          <div>
                            <p className="font-bold">{region.name}</p>
                            <p className="text-xs opacity-70">{region.name_bn}</p>
                          </div>
                          <div className="text-right">
                            <p className="col-header">Temp</p>
                            <p className={cn("data-value", getTempColor(region.current_temp))}>{region.current_temp}°C</p>
                          </div>
                          <div className="text-right">
                            <p className="col-header">Rain</p>
                            <p className="data-value">{region.current_rainfall}mm</p>
                            {region.lastUpdated && (
                              <p className="text-[6px] font-black uppercase tracking-widest text-muted mt-1">
                                {new Date(region.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Main Content: Analysis & Alerts */}
        <section className="p-8 overflow-y-auto bg-bg/30 backdrop-blur-sm">
          <AnimatePresence mode="wait">
            {viewMode === 'app' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto space-y-8 pb-24 md:pb-8"
              >
                {/* System Hub: All Options Discoverable */}
                <section className="bg-card-bg border border-line/50 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-5">
                    <LayoutGrid className="w-48 h-48" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center">
                        <LayoutGrid className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">System Hub</h2>
                        <p className="col-header !text-[9px] mt-1">Unified Command & Access Portal</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {NAV_ITEMS.filter(item => !item.adminOnly || userProfile?.role === 'admin').map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setViewMode(item.id as any)}
                          className={cn(
                            "group p-6 rounded-[2rem] border transition-all text-left relative overflow-hidden",
                            viewMode === item.id 
                              ? "bg-accent border-accent text-bg" 
                              : "bg-white/5 border-white/5 hover:border-accent/50 hover:bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                            viewMode === item.id ? "bg-white/20" : "bg-accent/10"
                          )}>
                            <item.icon className={cn("w-5 h-5", viewMode === item.id ? "text-white" : "text-accent")} />
                          </div>
                          <p className={cn("font-black uppercase tracking-tighter text-sm mb-1", viewMode === item.id ? "text-white" : "text-white")}>
                            {item.label}
                          </p>
                          <p className={cn("text-[8px] font-medium uppercase tracking-widest opacity-60 leading-tight", viewMode === item.id ? "text-white" : "text-muted")}>
                            {item.description}
                          </p>
                          {viewMode === item.id && (
                            <div className="absolute top-4 right-4">
                              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* High Priority Alert Banner */}
                {highPriorityAlert && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="bg-danger/20 border-2 border-danger/50 rounded-3xl p-6 flex items-center justify-between gap-6 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-danger/5 animate-pulse" />
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="w-16 h-16 bg-danger rounded-2xl flex items-center justify-center shadow-lg shadow-danger/20">
                        <ShieldAlert className="w-10 h-10 text-white animate-bounce" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="px-2 py-0.5 bg-danger text-white text-[8px] font-black uppercase tracking-widest rounded">Critical Alert</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-danger">{highPriorityAlert.hazard_type} Protocol Active</span>
                        </div>
                        <h3 className="text-2xl font-black tracking-tighter uppercase text-white leading-tight">
                          {highPriorityAlert.alert_msg_en}
                        </h3>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setAlert(highPriorityAlert);
                        setViewMode('app');
                      }}
                      className="px-8 py-4 bg-white text-danger font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-danger hover:text-white transition-all relative z-10 whitespace-nowrap"
                    >
                      Take Action Now
                    </button>
                  </motion.div>
                )}

                {/* Main Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Sector Monitor (Large) */}
                  <div className="md:col-span-8 space-y-8">
                    <div className="bg-card-bg border border-line/50 rounded-[3rem] p-10 relative overflow-hidden group shadow-2xl">
                      <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity className="w-48 h-48" />
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-6">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex gap-1">
                              {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Strategic Sector Monitor</span>
                          </div>
                          <h2 className="text-5xl font-black tracking-tighter uppercase leading-none text-white">
                            {currentRegionData.name} <span className="text-accent">Sector</span>
                            {weatherData?.isMock && (
                              <span className="ml-4 px-3 py-1 bg-warning/20 text-warning text-[10px] font-black uppercase tracking-widest rounded-full border border-warning/30 align-middle">
                                Demo Mode
                              </span>
                            )}
                          </h2>
                          <div className="flex items-center gap-4 mt-2">
                            {weatherError && (
                              <p className="text-xs text-danger font-bold uppercase tracking-widest">
                                {weatherError} - Using Demo Data
                              </p>
                            )}
                            {currentRegionData.lastUpdated && (
                              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-muted">
                                <Clock className="w-3 h-3" />
                                <span>Telemetry Last Updated: {new Date(currentRegionData.lastUpdated).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "px-6 py-3 rounded-[1.5rem] flex items-center gap-3 border transition-colors",
                            currentRegionData.risk_level === 'High' ? "bg-danger/10 border-danger/30 text-danger" :
                            currentRegionData.risk_level === 'Medium' ? "bg-warning/10 border-warning/30 text-warning" :
                            "bg-green-500/10 border-green-500/30 text-green-500"
                          )}>
                            <div className={cn("w-2.5 h-2.5 rounded-full", 
                              currentRegionData.risk_level === 'High' ? "bg-danger animate-ping" :
                              currentRegionData.risk_level === 'Medium' ? "bg-warning" :
                              "bg-green-500"
                            )} />
                            <span className="text-xs font-black uppercase tracking-widest">{currentRegionData.risk_level || 'Low'} Risk Level</span>
                          </div>
                        </div>
                      </div>

                      {!lowBandwidthMode ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                          {[
                            { icon: Droplets, label: 'Rainfall', value: weatherData?.rain?.['1h'] || currentRegionData.current_rainfall || '0', unit: 'mm/h', color: 'text-blue-400', bg: 'bg-blue-400/10' },
                            { icon: Wind, label: 'Wind Speed', value: weatherData?.wind?.speed || currentRegionData.current_wind_speed || '0', unit: 'km/h', color: 'text-teal-400', bg: 'bg-teal-400/10' },
                            { icon: Thermometer, label: 'Temperature', value: weatherData?.main?.temp?.toFixed(1) || currentRegionData.current_temp || '0', unit: '°C', color: 'text-orange-400', bg: 'bg-orange-400/10' },
                            { icon: Activity, label: 'Humidity', value: weatherData?.main?.humidity || currentRegionData.current_humidity || '0', unit: '%', color: 'text-purple-400', bg: 'bg-purple-400/10' }
                          ].map((stat, i) => (
                            <div key={i} className="bg-white/5 rounded-[2rem] p-6 border border-white/5 hover:border-white/10 transition-all hover:translate-y-[-4px]">
                              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
                                <stat.icon className={cn("w-6 h-6", stat.color)} />
                              </div>
                              <p className="col-header !text-[9px] mb-2">{stat.label}</p>
                              <p className="data-value text-3xl font-black text-white">{stat.value}<span className="text-xs ml-1 opacity-40 font-medium">{stat.unit}</span></p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <Zap className="w-8 h-8 text-accent" />
                            <div>
                              <p className="text-sm font-black text-white uppercase tracking-tight">Efficiency Mode Active</p>
                              <p className="text-xs text-muted">High-fidelity telemetry hidden to conserve bandwidth.</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setLowBandwidthMode(false)}
                            className="px-6 py-3 bg-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent hover:text-white transition-all"
                          >
                            Restore Fidelity
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 7-Day Forecast Engine */}
                    <ForecastEngine />

                    {/* Hazard Stream */}
                    <div className="bg-card-bg border border-line/50 rounded-[3rem] p-10 shadow-2xl">
                      <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center">
                            <Bell className="w-6 h-6 text-accent" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">Hazard Stream</h3>
                            <p className="col-header !text-[9px] mt-1">Real-time Intelligence Feed</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="col-header !text-[9px] px-4 py-2 bg-white/5 rounded-full border border-white/10">{activeAlerts.length} Active Events</span>
                          {!isOnline && (
                            <span className="px-4 py-2 bg-warning/10 text-warning text-[9px] font-black uppercase tracking-widest rounded-full border border-warning/20">Cached Data</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        {activeAlerts.length > 0 ? (
                          activeAlerts.map((alert) => (
                            <motion.div 
                              key={alert.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="group flex items-center justify-between p-8 bg-white/5 rounded-[2.5rem] border border-white/5 hover:border-accent/30 transition-all cursor-pointer hover:bg-white/[0.07]"
                              onClick={() => {
                                setAlert(alert);
                                setAlertTab('app');
                              }}
                            >
                              <div className="flex items-center gap-8">
                                <div className={cn(
                                  "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl transition-transform group-hover:scale-110",
                                  alert.risk_level === 'High' ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"
                                )}>
                                  <AlertTriangle className="w-8 h-8" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-4 mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-accent">{alert.hazard_type}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <h4 className="text-xl font-black tracking-tight text-white group-hover:text-accent transition-colors leading-tight">{alert.alert_msg_en}</h4>
                                </div>
                              </div>
                              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent/20 transition-all">
                                <ChevronRight className="w-6 h-6 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6">
                              <ShieldCheck className="w-12 h-12 text-green-500/30" />
                            </div>
                            <p className="text-xl font-black uppercase tracking-tighter text-muted">Sector Clear</p>
                            <p className="text-sm text-muted/50 mt-2">No active hazards detected in your current vicinity.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Widgets */}
                  <div className="md:col-span-4 space-y-8">
                    {/* Mesh Network Widget */}
                    <div className="bg-card-bg border border-line/50 rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Radio className="w-32 h-32" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", bluetoothEnabled ? "bg-accent/20" : "bg-white/5")}>
                              <Radio className={cn("w-6 h-6", bluetoothEnabled ? "text-accent animate-pulse" : "text-muted")} />
                            </div>
                            <div>
                              <h3 className="text-xl font-black tracking-tighter uppercase leading-none text-white">Mesh Relay</h3>
                              <p className="col-header !text-[9px] mt-1">Offline Connectivity</p>
                            </div>
                          </div>
                          <button 
                            onClick={toggleBluetoothMesh}
                            className={cn(
                              "w-12 h-6 rounded-full relative transition-all duration-300",
                              bluetoothEnabled ? "bg-accent" : "bg-white/10"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-md",
                              bluetoothEnabled ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>
                        
                        <p className="text-sm text-muted leading-relaxed mb-8 font-medium">
                          {bluetoothEnabled 
                            ? "Mesh network active. Your node is relaying hazard data to nearby devices without internet."
                            : "Activate Bluetooth Mesh to receive and relay alerts even in zero-connectivity environments."}
                        </p>

                        {bluetoothEnabled && discoveredNodes.length > 0 ? (
                          <div className="space-y-4">
                            <p className="col-header !text-[9px] uppercase tracking-widest text-accent">Active Peer Nodes</p>
                            <div className="flex flex-wrap gap-3">
                              {discoveredNodes.map(node => (
                                <span key={node} className="px-4 py-2 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest rounded-2xl border border-accent/20 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                                  {node}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : bluetoothEnabled && (
                          <div className="flex items-center gap-3 py-4 text-muted">
                            <div className="w-4 h-4 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Scanning for Peers...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Emergency Helplines */}
                    <div className="bg-card-bg border border-line/50 rounded-[3rem] p-10 shadow-2xl">
                      <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 bg-danger/10 rounded-2xl flex items-center justify-center">
                          <PhoneCall className="w-6 h-6 text-danger" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black tracking-tighter uppercase leading-none text-white">Helplines</h3>
                          <p className="col-header !text-[9px] mt-1">Direct Response Nodes</p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        {[
                          { label: 'National Helpline', number: '999', icon: ShieldAlert, color: 'text-danger', bg: 'bg-danger/10' },
                          { label: 'Disaster Support', number: '109', icon: LifeBuoy, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                          { label: 'Flood Control', number: '01715-040144', icon: Waves, color: 'text-teal-400', bg: 'bg-teal-400/10' }
                        ].map((contact, i) => (
                          <a 
                            key={i}
                            href={`tel:${contact.number}`}
                            className="flex items-center justify-between p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-accent/30 transition-all group hover:bg-white/[0.07]"
                          >
                            <div className="flex items-center gap-5">
                              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", contact.bg)}>
                                <contact.icon className={cn("w-6 h-6", contact.color)} />
                              </div>
                              <div>
                                <p className="col-header !text-[8px] mb-1">{contact.label}</p>
                                <p className="data-value text-base font-black text-white">{contact.number}</p>
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent/20 transition-all">
                              <Phone className="w-4 h-4 text-muted group-hover:text-accent" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Performance Widget */}
                    <div className="bg-card-bg border border-line/50 rounded-[3rem] p-10 shadow-2xl">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                          <Zap className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black tracking-tighter uppercase leading-none text-white">Performance</h3>
                          <p className="col-header !text-[9px] mt-1">Optimization Engine</p>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <Smartphone className="w-4 h-4 text-muted" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Low Bandwidth</span>
                          </div>
                          <button 
                            onClick={() => setLowBandwidthMode(!lowBandwidthMode)}
                            className={cn(
                              "px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all",
                              lowBandwidthMode ? "bg-accent text-white" : "bg-white/10 text-muted hover:bg-white/20"
                            )}
                          >
                            {lowBandwidthMode ? 'Enabled' : 'Disable'}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <Globe className="w-4 h-4 text-muted" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Offline Cache</span>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-success">Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Bottom Intelligence Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Active Alerts (Refined) */}
                  <div className="bg-card-bg border border-line/50 rounded-[3rem] p-10 shadow-2xl">
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-danger/10 rounded-2xl flex items-center justify-center">
                          <ShieldAlert className="w-6 h-6 text-danger" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">Active Protocols</h3>
                          <p className="col-header !text-[9px] mt-1">Live Hazard Management</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-4 py-2 bg-danger/10 text-danger text-[9px] font-black uppercase tracking-widest rounded-full border border-danger/20">
                          {activeAlerts.length} Active
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                      {activeAlerts.length > 0 ? (
                        activeAlerts.map((alert) => (
                          <motion.div 
                            key={alert.id} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "p-8 bg-white/5 border-l-8 rounded-r-[2rem] transition-all group cursor-pointer hover:bg-white/[0.08]",
                              alert.risk_level === 'High' ? 'border-danger' : 
                              alert.risk_level === 'Medium' ? 'border-warning' : 'border-blue-500'
                            )}
                            onClick={() => {
                              setAlert(alert);
                              setAlertTab('app');
                            }}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                                  {alert.hazard_type}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                                  {alert.risk_level} Risk
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-muted uppercase font-bold">
                                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <h4 className="text-xl font-black tracking-tight text-white mb-3 group-hover:text-accent transition-colors">{alert.alert_msg_en}</h4>
                            <p className="text-sm text-muted leading-relaxed mb-6 line-clamp-2 font-medium">{alert.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex -space-x-3">
                                {[1, 2, 3, 4].map(i => (
                                  <div key={i} className="w-8 h-8 rounded-full border-2 border-card-bg bg-white/10 flex items-center justify-center overflow-hidden">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + alert.id}`} alt="user" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                                <div className="w-8 h-8 rounded-full border-2 border-card-bg bg-accent/20 flex items-center justify-center">
                                  <span className="text-[8px] font-black text-accent">+12k</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakAlert(alert);
                                  }}
                                  className="p-3 bg-accent/10 hover:bg-accent hover:text-bg transition-all rounded-xl border border-accent/20"
                                  title="Voice Alert"
                                >
                                  <Radio className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAlertForFeedback(alert.id);
                                  }}
                                  className="p-3 bg-success/10 hover:bg-success hover:text-bg transition-all rounded-xl border border-success/20"
                                  title="Provide Feedback"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAlertForReport(alert.id);
                                  }}
                                  className="p-3 bg-danger/10 hover:bg-danger hover:text-bg transition-all rounded-xl border border-danger/20"
                                  title="Report False Alert"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Feedback & Report Inlines */}
                            <AnimatePresence>
                              {selectedAlertForFeedback === alert.id && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-6 pt-6 border-t border-white/10"
                                >
                                  <div className="flex justify-between items-center mb-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-accent">Alert Feedback</h5>
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedAlertForFeedback(null); }} className="text-muted hover:text-white">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <FeedbackSystem 
                                    alertId={alert.id} 
                                    regionId={alert.location} 
                                    onClose={() => setSelectedAlertForFeedback(null)} 
                                  />
                                </motion.div>
                              )}
                              
                              {selectedAlertForReport === alert.id && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-6 pt-6 border-t border-white/10"
                                >
                                  <div className="flex justify-between items-center mb-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-danger">False Alert Report</h5>
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedAlertForReport(null); }} className="text-muted hover:text-white">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <FalseAlertReport 
                                    alertId={alert.id} 
                                    onClose={() => setSelectedAlertForReport(null)} 
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                          <ShieldCheck className="w-16 h-16 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">No Active Protocols</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Insights (Modern) */}
                  <div className="bg-card-bg border border-line/50 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-accent/5 blur-[100px] rounded-full" />
                    
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center">
                          <BrainCircuit className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">AI Insights</h3>
                          <p className="col-header !text-[9px] mt-1">Predictive Risk Assessment</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent">Processing</span>
                      </div>
                    </div>

                    <div className="space-y-8 relative z-10">
                      <div className="p-8 bg-accent/5 border border-accent/20 rounded-[2.5rem]">
                        <p className="text-lg text-white leading-relaxed font-medium italic">
                          "Satellite telemetry indicates a 64% increase in upstream water velocity. Predictive models suggest a high probability of flash flooding in the <span className="text-accent font-black">{selectedRegion.name}</span> sector within the next 4-6 hours."
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5">
                          <p className="col-header !text-[8px] mb-2">Confidence Score</p>
                          <div className="flex items-end gap-3">
                            <p className="text-3xl font-black text-white">92<span className="text-xs opacity-40">%</span></p>
                            <div className="flex gap-1 mb-2">
                              {[1, 2, 3, 4, 5].map(i => <div key={i} className={cn("w-1 h-3 rounded-full", i <= 4 ? "bg-accent" : "bg-white/10")} />)}
                            </div>
                          </div>
                        </div>
                        <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5">
                          <p className="col-header !text-[8px] mb-2">Impact Radius</p>
                          <p className="text-3xl font-black text-white">12.4<span className="text-xs opacity-40">km</span></p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="col-header !text-[9px] uppercase tracking-widest text-muted">Strategic Recommendations</p>
                        <div className="space-y-3">
                          {[
                            'Initiate pre-emptive evacuation of low-lying zones.',
                            'Deploy mobile mesh nodes to primary shelter routes.',
                            'Activate emergency SMS broadcast for offline users.'
                          ].map((rec, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                              <div className="w-6 h-6 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Check className="w-3.5 h-3.5 text-accent" />
                              </div>
                              <p className="text-xs text-white/80 font-medium leading-relaxed">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Community and Stats */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* Community Ground Reality */}
                  <div className="xl:col-span-1 glass p-8 rounded-2xl border border-line/50">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-2 h-8 bg-purple-500 rounded-full" />
                      <h3 className="text-2xl font-black tracking-tighter uppercase">Ground Reality</h3>
                    </div>
                    
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {communityFeedback.length > 0 ? (
                        communityFeedback.map((feedback, idx) => (
                          <div key={feedback.id || idx} className="p-4 bg-bg/40 border border-line/30 rounded-xl hover:bg-bg/60 transition-all">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star key={star} className={cn("w-2 h-2", feedback.accuracy >= star ? "text-accent fill-current" : "text-muted")} />
                                ))}
                              </div>
                              <span className="text-[9px] font-mono text-muted">{new Date(feedback.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-white/90 mb-3 italic leading-relaxed">"{feedback.comments || 'No comments provided'}"</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                                  <User className="w-3 h-3 text-accent" />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Verified Observer</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] font-black uppercase tracking-widest text-muted">Utility:</span>
                                <span className="text-[8px] font-black text-accent">{feedback.usefulness}/5</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 opacity-30">
                          <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">No recent reports</p>
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => setViewMode('profile')}
                      className="w-full py-4 border border-dashed border-line/50 mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-accent hover:border-accent transition-all rounded-xl"
                    >
                      Submit Observation
                    </button>
                  </div>

                  {/* Regional Telemetry */}
                  <div className="xl:col-span-2 glass p-8 rounded-2xl border border-line/50">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-accent rounded-full" />
                        <h3 className="text-2xl font-black tracking-tighter uppercase">Regional Telemetry</h3>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Rainfall</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Temp</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={(historicalBMBData.length > 0 ? historicalBMBData : [
                          { timestamp: '00:00', rainfall: 2, temperature: 24, districtId: '', uploadedBy: '' },
                          { timestamp: '04:00', rainfall: 5, temperature: 22, districtId: '', uploadedBy: '' },
                          { timestamp: '08:00', rainfall: 12, temperature: 26, districtId: '', uploadedBy: '' },
                          { timestamp: '12:00', rainfall: 8, temperature: 32, districtId: '', uploadedBy: '' },
                          { timestamp: '16:00', rainfall: 15, temperature: 30, districtId: '', uploadedBy: '' },
                          { timestamp: '20:00', rainfall: 22, temperature: 27, districtId: '', uploadedBy: '' },
                        ]) as BMBData[]}>
                          <defs>
                            <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis 
                            dataKey="timestamp" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 'bold' }} 
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1A1D23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="rainfall" 
                            stroke="#3b82f6" 
                            fillOpacity={1} 
                            fill="url(#colorRain)" 
                            strokeWidth={3} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="temperature" 
                            stroke="#FF6B00" 
                            fillOpacity={1} 
                            fill="url(#colorTemp)" 
                            strokeWidth={3} 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {viewMode === 'map' && (
              <motion.div 
                key="map"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-[calc(100vh-120px)] flex flex-col max-w-7xl mx-auto w-full"
              >
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-8 bg-blue-500 rounded-full" />
                      <h2 className="text-4xl font-black tracking-tighter uppercase">Hazard & Shelter GIS</h2>
                    </div>
                    <p className="col-header !text-muted">Live Geospatial Intelligence // Bangladesh Sector</p>
                  </div>
                </div>
                
                <div className="flex-1 glass relative overflow-hidden rounded-3xl border border-line/50 group">
                  <NavigationMap 
                    userLocation={userProfile?.location} 
                    onRegionSelect={setSelectedRegion}
                  />
                </div>
              </motion.div>
            )}

            {viewMode === 'sos' && (
              <motion.div 
                key="sos"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-6xl mx-auto space-y-12"
              >
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6 relative group" onClick={triggerSos}>
                    <div className="absolute inset-0 bg-danger/20 rounded-full animate-ping" />
                    <LifeBuoy className={cn("w-12 h-12 text-danger relative z-10 group-hover:rotate-90 transition-transform duration-500", isTriggeringSos && "animate-spin")} />
                  </div>
                  <h2 className="text-6xl font-black tracking-tighter uppercase text-white">Emergency Response Node</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-danger animate-pulse">Critical Assistance Protocol // Active</p>
                </div>

                {/* One-Tap SOS Button */}
                <div className="flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={triggerSos}
                    disabled={isTriggeringSos}
                    className={cn(
                      "w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 border-8 shadow-[0_0_50px_rgba(255,68,68,0.3)] transition-all",
                      isTriggeringSos 
                        ? "bg-danger/20 border-danger/30 cursor-wait" 
                        : "bg-danger border-white/20 hover:border-white/40"
                    )}
                  >
                    <ShieldAlert className={cn("w-20 h-20 text-white", isTriggeringSos && "animate-spin")} />
                    <span className="text-2xl font-black tracking-tighter uppercase text-white">
                      {isTriggeringSos ? 'Broadcasting...' : 'Trigger SOS'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">One-Tap Emergency</span>
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center gap-4 mb-2">
                      <PhoneCall className="w-5 h-5 text-danger" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">Direct Uplink Hotlines</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {EMERGENCY_CONTACTS.map(contact => (
                        <motion.a 
                          whileHover={{ scale: 1.02, x: 5 }}
                          key={contact.id}
                          href={`tel:${contact.number}`}
                          className="glass p-8 rounded-[2rem] border border-line/50 hover:border-danger/50 transition-all group flex items-center justify-between relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-danger opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="space-y-1">
                            <p className="text-2xl font-black tracking-tighter uppercase text-white group-hover:text-danger transition-colors">{contact.name}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted">{contact.description}</p>
                            <p className="text-xl font-mono font-black text-danger mt-2">{contact.number}</p>
                          </div>
                          <div className="w-14 h-14 rounded-2xl bg-bg/50 border border-line/50 flex items-center justify-center group-hover:bg-danger group-hover:text-bg transition-all shadow-xl">
                            <PhoneCall className="w-6 h-6" />
                          </div>
                        </motion.a>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="flex items-center gap-4 mb-2">
                      <Radio className="w-5 h-5 text-accent" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">Offline Mesh Relay</h3>
                    </div>
                    <div className="glass p-8 rounded-[2.5rem] border border-line/50 space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Bluetooth Mesh</span>
                        <button 
                          onClick={toggleBluetoothMesh}
                          className={cn(
                            "px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                            bluetoothEnabled ? "bg-accent text-bg" : "bg-bg/50 text-muted border border-line/50"
                          )}
                        >
                          {bluetoothEnabled ? 'Active' : 'Enable'}
                        </button>
                      </div>
                      
                      {bluetoothEnabled && (
                        <div className="space-y-4">
                          <div className="p-4 bg-accent/5 rounded-2xl border border-accent/20">
                            <p className="text-[9px] font-black uppercase tracking-widest text-accent mb-2">Nearby Nodes</p>
                            <div className="space-y-2">
                              {discoveredNodes.map(node => (
                                <div key={node} className="flex items-center justify-between">
                                  <span className="text-xs font-mono text-white">{node}</span>
                                  <div className="flex gap-1">
                                    {[1, 2, 3].map(i => (
                                      <div key={i} className="w-1 h-3 bg-accent/30 rounded-full" />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-[8px] font-bold text-muted uppercase leading-relaxed">
                            Your device is now acting as a relay node. Alerts will be shared with nearby devices even without internet.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mb-2">
                      <Users className="w-5 h-5 text-success" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">Local Volunteers</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="glass p-6 rounded-2xl border border-line/50 flex items-center gap-4">
                        <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                          <Users className="w-6 h-6 text-success" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase">Community Broadcast</p>
                          <p className="text-[9px] font-bold text-muted uppercase">Notify local volunteers</p>
                        </div>
                        <button 
                          onClick={() => setViewMode('community')}
                          className="ml-auto w-10 h-10 rounded-full bg-bg/50 border border-line/50 flex items-center justify-center hover:bg-success hover:text-bg transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {viewMode === 'community' && (
              <motion.div 
                key="community"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto space-y-12"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-8 bg-success rounded-full" />
                      <h2 className="text-4xl font-black tracking-tighter uppercase">Community Network</h2>
                    </div>
                    <p className="col-header !text-muted">Local Volunteers & Authority Integration</p>
                  </div>
                  <button 
                    onClick={() => setViewMode('sos')}
                    className="glass px-6 py-3 rounded-xl border border-line/50 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-bg transition-all"
                  >
                    Back to Emergency
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="glass p-8 rounded-[2.5rem] border border-line/50">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black tracking-tighter uppercase">Active Volunteers // {selectedRegion.name}</h3>
                        <div className="flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/20 rounded-full">
                          <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                          <span className="text-[8px] font-black text-success uppercase tracking-widest">12 Online</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { name: 'Rahim Ahmed', specialty: 'First Aid', phone: '01712345678' },
                          { name: 'Karim Ullah', specialty: 'Rescue', phone: '01812345678' },
                          { name: 'Fatima Begum', specialty: 'Logistics', phone: '01912345678' },
                          { name: 'Abul Kashem', specialty: 'Shelter Mgmt', phone: '01512345678' }
                        ].map((v, i) => (
                          <div key={i} className="p-6 bg-bg/40 rounded-2xl border border-line/30 flex items-center justify-between group hover:border-success/30 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center text-success font-black">
                                {v.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-black text-white uppercase">{v.name}</p>
                                <p className="text-[9px] font-bold text-muted uppercase">{v.specialty}</p>
                              </div>
                            </div>
                            <a href={`tel:${v.phone}`} className="w-10 h-10 rounded-xl bg-bg/50 border border-line/50 flex items-center justify-center hover:bg-success hover:text-bg transition-all">
                              <Phone className="w-4 h-4" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass p-8 rounded-[2.5rem] border border-line/50">
                      <h3 className="text-xl font-black tracking-tighter uppercase mb-8">Community Broadcast Mode</h3>
                      <div className="space-y-6">
                        <div className="p-6 bg-accent/5 rounded-2xl border border-accent/20">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                              <Radio className="w-5 h-5 text-bg" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-white uppercase">Broadcast to Nearby Nodes</p>
                              <p className="text-[9px] font-bold text-muted uppercase">Send instant message to all mesh devices</p>
                            </div>
                          </div>
                          <textarea 
                            placeholder="Type emergency message..."
                            className="w-full bg-bg/50 border border-line/50 rounded-xl p-4 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent transition-all h-32"
                          />
                          <button className="mt-4 w-full py-4 bg-accent text-bg font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                            Broadcast Message
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="glass p-8 rounded-[2.5rem] border border-line/50">
                      <h3 className="text-xl font-black tracking-tighter uppercase mb-6">Local Authorities</h3>
                      <div className="space-y-4">
                        {[
                          { name: 'Upazila Nirbahi Officer', role: 'Chief Coordinator' },
                          { name: 'Local Police Station', role: 'Law Enforcement' },
                          { name: 'Fire Service Dept', role: 'Rescue Operations' },
                          { name: 'Civil Surgeon Office', role: 'Medical Emergency' }
                        ].map((a, i) => (
                          <div key={i} className="p-4 bg-bg/40 rounded-xl border border-line/30 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black text-white uppercase">{a.name}</p>
                              <p className="text-[8px] font-bold text-muted uppercase">{a.role}</p>
                            </div>
                            <div className="w-2 h-2 bg-success rounded-full" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass p-8 rounded-[2.5rem] border border-line/50 bg-danger/5 border-danger/20">
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-5 h-5 text-danger" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-danger">Volunteer Protocol</h3>
                      </div>
                      <p className="text-[10px] text-white/70 leading-relaxed font-medium">
                        Volunteers are trained community members. In case of emergency, follow their instructions for safe evacuation and shelter management.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {viewMode === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto"
              >
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tighter uppercase">Alert History</h2>
                    <p className="col-header">Past warnings and disaster records</p>
                  </div>
                  <div className="flex gap-2">
                    <select className="p-2 bg-bg border border-line text-[10px] font-bold uppercase tracking-widest outline-none">
                      <option>All Hazards</option>
                      <option>Flood</option>
                      <option>Cyclone</option>
                    </select>
                    <select className="p-2 bg-bg border border-line text-[10px] font-bold uppercase tracking-widest outline-none">
                      <option>Last 30 Days</option>
                      <option>Last 6 Months</option>
                      <option>2025 Records</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  {activeAlerts.length === 0 ? (
                    <div className="p-12 border border-dashed border-line text-center opacity-50">
                      <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="uppercase tracking-widest font-bold text-xs">No historical records found for this criteria</p>
                    </div>
                  ) : (
                    activeAlerts.map(alert => (
                      <div key={alert.id} className="p-6 border border-line bg-bg hover:border-accent transition-colors flex justify-between items-center group cursor-pointer">
                        <div className="flex items-center gap-6">
                          <div className={cn("w-2 h-12", getRiskColor(alert.risk_level).split(' ')[0])} />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{alert.hazard_type}</span>
                              <span className="text-[10px] opacity-30">•</span>
                              <span className="text-[10px] opacity-50 uppercase tracking-widest">{new Date(alert.timestamp).toLocaleDateString()}</span>
                            </div>
                            <h4 className="text-lg font-bold tracking-tight group-hover:text-accent transition-colors">{alert.location}</h4>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Risk Level</p>
                          <p className={cn("text-xs font-bold uppercase tracking-widest", alert.risk_level === 'Extreme' || alert.risk_level === 'High' ? 'text-accent' : 'text-success')}>
                            {alert.risk_level}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {viewMode === 'admin' && userProfile?.role === 'admin' && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto space-y-12"
              >
                <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                  <div className="space-y-2">
                    <h2 className="text-6xl font-black tracking-tighter uppercase text-white">Command & Control Center</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Manual Alert Dissemination & System Monitoring</p>
                  </div>
                  <div className="flex gap-10 p-8 glass rounded-[2.5rem] border border-line/50">
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-2">Active Nodes</p>
                      <p className="text-4xl font-black text-white">{activeAlerts.length}</p>
                    </div>
                    <div className="w-px h-12 bg-line/30" />
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-2">Network Load</p>
                      <p className="text-4xl font-black text-success">12.4K</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-10">
                    <div className="glass p-10 rounded-[3rem] border border-line/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-10 opacity-5">
                        <Bell className="w-48 h-48" />
                      </div>
                      <h3 className="text-2xl font-black tracking-tighter uppercase text-white mb-10 flex items-center gap-4">
                        <div className="p-3 bg-accent/10 rounded-2xl">
                          <Bell className="w-6 h-6 text-accent" />
                        </div>
                        Manual Alert Generation
                      </h3>
                      <form className="space-y-8" onSubmit={async (e) => {
                        e.preventDefault();
                        setLoading(true);
                        try {
                          const alertData = {
                            ...manualAlert,
                            location: selectedRegion.name,
                            timestamp: new Date().toISOString(),
                            is_active: true
                          };
                          try {
                            await addDoc(collection(db, 'alerts'), alertData);
                          } catch (err) {
                            handleFirestoreError(err, OperationType.WRITE, 'alerts');
                          }
                          // Notification logic here
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Hazard Type</label>
                            <select 
                              className="w-full p-5 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-black uppercase tracking-widest text-xs text-white transition-all"
                              value={manualAlert.hazard_type}
                              onChange={(e) => setManualAlert({...manualAlert, hazard_type: e.target.value as any})}
                            >
                              <option className="bg-ink">Flood</option>
                              <option className="bg-ink">Cyclone</option>
                              <option className="bg-ink">Heatwave</option>
                              <option className="bg-ink">Earthquake</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Risk Level</label>
                            <select 
                              className="w-full p-5 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-black uppercase tracking-widest text-xs text-white transition-all"
                              value={manualAlert.risk_level}
                              onChange={(e) => setManualAlert({...manualAlert, risk_level: e.target.value as any})}
                            >
                              <option className="bg-ink">Low</option>
                              <option className="bg-ink">Moderate</option>
                              <option className="bg-ink">High</option>
                              <option className="bg-ink">Extreme</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Target Sector</label>
                          <select className="w-full p-5 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-black uppercase tracking-widest text-xs text-white transition-all">
                            {BANGLADESH_REGIONS.map(r => (
                              <option key={r.id} className="bg-ink">{r.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Alert Intelligence Payload</label>
                          <textarea 
                            className="w-full p-6 bg-bg/50 border border-line/50 rounded-3xl focus:border-accent outline-none text-sm h-40 text-white leading-relaxed transition-all" 
                            placeholder="Synthesize alert details for dissemination..."
                            value={manualAlert.description}
                            onChange={(e) => setManualAlert({...manualAlert, description: e.target.value})}
                          />
                        </div>
                        <motion.button 
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading}
                          className="w-full py-6 bg-accent text-bg rounded-3xl font-black uppercase tracking-[0.3em] hover:bg-white transition-all shadow-2xl shadow-accent/20 flex items-center justify-center gap-4"
                        >
                          {loading ? (
                            <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <ShieldAlert className="w-5 h-5" /> Initiate Dissemination
                            </>
                          )}
                        </motion.button>
                      </form>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div className="glass p-10 rounded-[3rem] border border-line/50 space-y-8">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-3">
                        <Activity className="w-4 h-4 text-success" /> System Health Matrix
                      </h3>
                      <div className="space-y-6">
                        {[
                          { name: 'BMD API Network', status: 'Connected', color: 'text-success' },
                          { name: 'BWDB Telemetry', status: 'Connected', color: 'text-success' },
                          { name: 'SMS Gateway Node', status: 'Ready', color: 'text-success' },
                          { name: 'AI Logic Engine', status: 'Active', color: 'text-success' },
                          { name: 'Satellite Uplink', status: 'Standby', color: 'text-accent' },
                        ].map((sys, i) => (
                          <div key={i} className="flex justify-between items-center group">
                            <span className="text-xs font-black uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">{sys.name}</span>
                            <div className="flex items-center gap-3">
                              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", sys.color.replace('text-', 'bg-'))} />
                              <span className={cn("text-[10px] font-black uppercase tracking-widest", sys.color)}>{sys.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={syncWeather}
                        disabled={isSyncing}
                        className="w-full py-4 bg-bg/50 border border-line/50 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white hover:bg-accent hover:text-bg transition-all flex items-center justify-center gap-3"
                      >
                        {isSyncing ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Sync All Districts Weather
                      </motion.button>
                    </div>
                    
                    <div className="glass p-10 rounded-[3rem] border border-line/50 space-y-8">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-3">
                        <History className="w-4 h-4 text-accent" /> Recent Activity Log
                      </h3>
                      <div className="space-y-4">
                        <div className="p-5 bg-bg/50 border-l-4 border-accent rounded-2xl space-y-1">
                          <p className="text-xs font-black text-white uppercase tracking-tight">Alert Disseminated</p>
                          <p className="text-[9px] font-black text-muted uppercase tracking-widest">Sylhet // Flood // 10m ago</p>
                        </div>
                        <div className="p-5 bg-bg/50 border-l-4 border-success rounded-2xl space-y-1">
                          <p className="text-xs font-black text-white uppercase tracking-tight">Telemetry Sync</p>
                          <p className="text-[9px] font-black text-muted uppercase tracking-widest">BMD Server // 2m ago</p>
                        </div>
                        <div className="p-5 bg-bg/50 border-l-4 border-blue-500 rounded-2xl space-y-1">
                          <p className="text-xs font-black text-white uppercase tracking-tight">Node Access</p>
                          <p className="text-[9px] font-black text-muted uppercase tracking-widest">Admin azrafinam // 1m ago</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {viewMode === 'app' && alert && (
              <motion.div 
                key="alert-details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-6xl mx-auto space-y-10"
              >
                <div className={cn(
                  "glass p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8 shadow-2xl relative overflow-hidden",
                  alert.risk_level === 'Extreme' ? 'border-danger/50 shadow-danger/10' : 
                  alert.risk_level === 'High' ? 'border-orange-500/50 shadow-orange-500/10' : 'border-success/50 shadow-success/10'
                )}>
                  <div className="absolute top-0 right-0 p-10 opacity-5 hidden md:block">
                    <ShieldAlert className="w-48 h-48" />
                  </div>
                  <div className="relative z-10 space-y-2 md:space-y-4 w-full">
                    <div className="flex flex-wrap items-center gap-3 md:gap-4">
                      <div className={cn("px-3 md:px-4 py-1 rounded-full text-[8px] md:text-[10px] font-black tracking-widest uppercase border",
                        alert.risk_level === 'Extreme' ? 'bg-danger/10 border-danger text-danger' : 
                        alert.risk_level === 'High' ? 'bg-orange-500/10 border-orange-500 text-orange-500' : 'bg-success/10 border-success text-success'
                      )}>
                        {alert.risk_level} Risk Level
                      </div>
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                        {alert.hazard_type} Protocol
                      </span>
                    </div>
                    <h2 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white uppercase leading-[0.9] break-words">
                      {alert.location}
                    </h2>
                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-muted">Active Warning Node // Sector 0{selectedRegion.id}</p>
                  </div>
                  <div className="relative z-10 flex gap-3 md:gap-6 w-full md:w-auto">
                    <div className="flex-1 md:flex-none p-4 md:p-6 glass rounded-[1.5rem] md:rounded-[2rem] border border-line/50 text-center min-w-[100px] md:min-w-[140px]">
                      <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-muted mb-1 md:mb-2">Rainfall</p>
                      <p className="text-xl md:text-3xl font-black text-white">
                        {weatherData?.rain?.['1h'] || selectedRegion.current_rainfall}
                        <span className="text-[10px] md:text-xs text-muted ml-1">mm</span>
                      </p>
                    </div>
                    <div className="flex-1 md:flex-none p-4 md:p-6 glass rounded-[1.5rem] md:rounded-[2rem] border border-line/50 text-center min-w-[100px] md:min-w-[140px]">
                      <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-muted mb-1 md:mb-2">Wind Speed</p>
                      <p className="text-xl md:text-3xl font-black text-white">
                        {weatherData?.wind?.speed ? (weatherData.wind.speed * 3.6).toFixed(1) : (selectedRegion.current_rainfall / 2).toFixed(1)}
                        <span className="text-[10px] md:text-xs text-muted ml-1">km/h</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-2 space-y-10">
                    <div className="glass p-10 rounded-[3rem] border border-line/50 space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-accent/10 rounded-2xl">
                          <BrainCircuit className="w-6 h-6 text-accent" />
                        </div>
                        <h3 className="text-2xl font-black tracking-tighter uppercase text-white">Intelligence Summary</h3>
                      </div>
                      <div className="p-8 bg-bg/30 rounded-3xl border border-line/30 space-y-6">
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-muted">English Protocol</p>
                          <p className="text-xl leading-relaxed text-white/80 font-medium">
                            {alert.alert_msg_en}
                          </p>
                        </div>
                        <div className="w-full h-px bg-line/30" />
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-muted">বাংলা সতর্কতা</p>
                          <p className="text-2xl leading-relaxed text-white font-black">
                            {alert.alert_msg_bn}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="px-4 py-2 bg-white/5 border border-line/50 rounded-xl flex items-center gap-3">
                          <Clock className="w-4 h-4 text-muted" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Issued: {new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="px-4 py-2 bg-white/5 border border-line/50 rounded-xl flex items-center gap-3">
                          <Globe className="w-4 h-4 text-muted" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Source: BMD Central</span>
                        </div>
                        <button 
                          onClick={() => sendEmergencySms(userProfile?.phone || "", `EMERGENCY ALERT: ${alert.alert_msg_en}`)}
                          disabled={isSendingSms || !userProfile?.phone}
                          className={cn(
                            "px-4 py-2 bg-accent/10 border border-accent/30 rounded-xl flex items-center gap-3 hover:bg-accent/20 transition-all",
                            (isSendingSms || !userProfile?.phone) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Smartphone className={cn("w-4 h-4 text-accent", isSendingSms && "animate-pulse")} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                            {isSendingSms ? "Broadcasting..." : "Broadcast SMS Alert"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className={cn(
                      "glass p-10 rounded-[3rem] border transition-all duration-500 space-y-8 relative overflow-hidden",
                      alert.risk_level === 'Low' ? "border-success/30 bg-success/5" : "border-line/50"
                    )}>
                      {alert.risk_level === 'Low' && (
                        <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                          <Wind className="w-64 h-64 text-success" />
                        </div>
                      )}
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-2xl transition-colors",
                            alert.risk_level === 'Low' ? "bg-success/20" : "bg-success/10"
                          )}>
                            <ShieldCheck className={cn("w-6 h-6", alert.risk_level === 'Low' ? "text-success" : "text-success")} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black tracking-tighter uppercase text-white">Action Protocol</h3>
                            {alert.risk_level === 'Low' && (
                              <p className="text-[10px] font-black uppercase tracking-widest text-success">Precautionary Phase // Normal Operations</p>
                            )}
                          </div>
                        </div>
                        {alert.risk_level === 'Low' && (
                          <div className="px-4 py-1.5 bg-success/10 border border-success/30 rounded-full flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                            <span className="text-[8px] font-black text-success uppercase tracking-widest">Safe Zone Status</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                        {[
                          { title: 'Monitoring', desc: 'Maintain normal awareness and monitor official BMD updates.', icon: Radio },
                          { title: 'Inventory', desc: 'Check emergency kits and ensure basic supplies are stocked.', icon: LifeBuoy },
                          { title: 'Structural', desc: 'Inspect shelter points and secure loose outdoor items.', icon: Home },
                          { title: 'Network', desc: 'Ensure mobile connectivity and app sync is active.', icon: Smartphone },
                        ].map((action, i) => (
                          <div key={i} className={cn(
                            "p-6 border rounded-3xl space-y-3 group transition-all duration-300",
                            alert.risk_level === 'Low' 
                              ? "bg-bg/40 border-success/20 hover:border-success/50 hover:bg-success/5" 
                              : "bg-bg/50 border-line/30 hover:border-accent/50"
                          )}>
                            <div className="flex items-center gap-3">
                              <action.icon className={cn("w-5 h-5", alert.risk_level === 'Low' ? "text-success" : "text-accent")} />
                              <p className="text-sm font-black text-white uppercase tracking-tight">{action.title}</p>
                            </div>
                            <p className="text-xs text-muted leading-relaxed">{action.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div className="glass p-10 rounded-[3rem] border border-line/50 space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Ground Truth</h3>
                        <div className="px-2 py-1 bg-accent/10 border border-accent/20 rounded-lg">
                          <span className="text-[8px] font-black text-accent uppercase tracking-widest">Live Feed</span>
                        </div>
                      </div>
                      <div className="space-y-6">
                        {reports.filter(r => r.location === alert.location).length === 0 ? (
                          <div className="py-12 text-center opacity-20">
                            <Radio className="w-12 h-12 mx-auto mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No local reports</p>
                          </div>
                        ) : (
                          reports.filter(r => r.location === alert.location).map((report, i) => (
                            <div key={i} className="p-5 bg-bg/50 border border-line/30 rounded-2xl space-y-3 relative overflow-hidden group">
                              <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="flex justify-between items-start">
                                <p className="text-[10px] font-black text-white uppercase tracking-tight">{report.userName || 'Anonymous'}</p>
                                <span className="text-[8px] font-black text-muted uppercase">{new Date(report.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-xs text-white/70 leading-relaxed italic">"{report.description}"</p>
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-success rounded-full" />
                                <span className="text-[8px] font-black text-success uppercase tracking-widest">Verified Signal</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <motion.button 
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 bg-bg border border-line/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:border-accent hover:text-accent transition-all"
                      >
                        Submit Intelligence
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 p-2 bg-bg/30 rounded-[2rem] border border-line/30 backdrop-blur-sm w-fit mx-auto">
                  {[
                    { id: 'app', label: 'Intelligence', icon: BrainCircuit },
                    { id: 'sms', label: 'SMS Protocol', icon: Smartphone },
                    { id: 'technical', label: 'Technical', icon: Cpu },
                    { id: 'dialect', label: 'Dialect', icon: Languages },
                  ].map((tab) => (
                    <button 
                      key={tab.id}
                      onClick={() => setAlertTab(tab.id as any)}
                      className={cn(
                        "px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all border",
                        alertTab === tab.id 
                          ? "bg-accent text-bg border-accent shadow-lg shadow-accent/20" 
                          : "bg-transparent border-transparent text-muted hover:text-white"
                      )}
                    >
                      <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                  {alertTab === 'app' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Analysis Card */}
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass p-8 rounded-3xl border border-line/50 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] rounded-full" />
                        <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-3">
                          <BrainCircuit className="w-5 h-5 text-accent" />
                          AI Risk Analysis
                        </h3>
                        <div className="prose prose-invert max-w-none">
                          <div className="markdown-body">
                            <Markdown>{alert.alert_msg_en}</Markdown>
                          </div>
                        </div>
                      </motion.div>

                      {/* Action Protocols */}
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass p-8 rounded-3xl border border-line/50"
                      >
                        <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-3">
                          <ShieldAlert className="w-5 h-5 text-danger" />
                          Action Protocols
                        </h3>
                        <div className="space-y-4">
                          {alert.action_steps.map((step, i) => (
                            <div key={i} className="flex gap-4 p-4 bg-bg/40 border border-line/30 rounded-2xl group hover:border-accent/50 transition-all">
                              <div className="w-8 h-8 rounded-full bg-bg border border-line/50 flex items-center justify-center text-[10px] font-black text-accent group-hover:bg-accent group-hover:text-bg transition-all">
                                {i + 1}
                              </div>
                              <p className="text-[11px] font-bold text-white/90 leading-relaxed self-center">{step}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {alertTab === 'sms' && (
                    <div className="flex items-center justify-center py-12">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-[320px] bg-ink border-[12px] border-line rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-line rounded-b-2xl z-20" />
                        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10 space-y-8 pt-6">
                          <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black text-white/50">9:41</span>
                            <div className="flex gap-1">
                              <div className="w-3 h-3 rounded-full bg-white/20" />
                              <div className="w-3 h-3 rounded-full bg-white/20" />
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-accent rounded-2xl flex items-center justify-center">
                                <ShieldAlert className="w-6 h-6 text-bg" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white">SafeSignal BD</p>
                                <p className="text-[8px] font-bold text-success uppercase tracking-widest">Verified Uplink</p>
                              </div>
                            </div>

                            <motion.div 
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="bg-line/50 backdrop-blur-md text-white p-5 rounded-3xl rounded-tl-none text-xs font-bold border-l-4 border-accent shadow-xl"
                            >
                              {alert.sms_format || "No SMS format provided."}
                            </motion.div>
                            
                            <div className="pt-4 text-center">
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Concise Warning Protocol // SMS-01</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/20 rounded-full" />
                      </motion.div>
                    </div>
                  )}

                  {alertTab === 'technical' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass p-10 rounded-[2.5rem] border border-line/50 font-mono text-sm leading-relaxed shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                        <BrainCircuit className="w-48 h-48" />
                      </div>
                      
                      <div className="relative z-10">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10 border-b border-line/30 pb-8">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-accent animate-pulse rounded-full" />
                              <h3 className="text-2xl font-black tracking-tighter uppercase text-white">Analysis Report // {alert.hazard_type}</h3>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Deep Intelligence Diagnostic Node</p>
                          </div>
                          <div className="px-4 py-2 bg-bg/50 border border-line/30 rounded-xl">
                            <span className="text-[10px] font-black text-accent uppercase tracking-widest">REF: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                          <div className="lg:col-span-3 space-y-8">
                            <div className="p-8 bg-bg/30 rounded-3xl border border-line/30 relative group">
                              <div className="absolute top-4 right-4">
                                <Cpu className="w-5 h-5 text-accent opacity-30 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="whitespace-pre-wrap text-white/80 leading-loose first-letter:text-4xl first-letter:font-black first-letter:text-accent first-letter:mr-2 first-letter:float-left">
                                {alert.technical_summary || "Generating technical analysis..."}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                              <div className="p-4 bg-bg/50 border border-line/30 rounded-2xl space-y-2">
                                <p className="text-[8px] font-black uppercase tracking-widest text-muted">Data Source</p>
                                <p className="text-xs font-black text-white uppercase">BMD/FFWC NETWORK</p>
                              </div>
                              <div className="p-4 bg-bg/50 border border-line/30 rounded-2xl space-y-2">
                                <p className="text-[8px] font-black uppercase tracking-widest text-muted">Logic Engine</p>
                                <p className="text-xs font-black text-white uppercase">RANDOM FOREST V2.4</p>
                              </div>
                              <div className="p-4 bg-bg/50 border border-line/30 rounded-2xl space-y-2">
                                <p className="text-[8px] font-black uppercase tracking-widest text-muted">Confidence</p>
                                <p className="text-xs font-black text-success uppercase">94.2% NOMINAL</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="p-6 bg-accent/5 border border-accent/20 rounded-3xl space-y-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-accent">System Status</p>
                              <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-line/50 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.random() * 100}%` }}
                                        className="h-full bg-accent"
                                      />
                                    </div>
                                    <span className="text-[8px] font-black text-muted">0{i}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="p-6 bg-bg/50 border border-line/30 rounded-3xl text-center space-y-2">
                              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-6 h-6 text-success" />
                              </div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-white">Diagnostic Pass</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {alertTab === 'dialect' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-10"
                    >
                      <div className="flex flex-wrap gap-3 p-4 bg-bg/30 rounded-[2rem] border border-line/30 backdrop-blur-sm">
                        {(['Standard', 'Chatgaiya', 'Sylheti', 'Noakhailla', 'Dhakaiya', 'Barishali'] as Dialect[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => {
                              setSelectedDialect(d);
                              handleTranslate(d);
                            }}
                            className={cn(
                              "px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border",
                              selectedDialect === d 
                                ? "bg-accent text-bg border-accent shadow-lg shadow-accent/20" 
                                : "bg-bg/50 border-line/50 text-muted hover:border-accent/50"
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>

                      <div className="min-h-[400px] flex items-center justify-center">
                        {translating ? (
                          <div className="flex flex-col items-center gap-6">
                            <div className="relative">
                              <div className="w-20 h-20 border-4 border-line border-t-accent rounded-full animate-spin" />
                              <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-accent animate-pulse" />
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-black tracking-tighter uppercase text-white">Linguistic Processing</p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted mt-2">Synthesizing {selectedDialect} Dialect...</p>
                            </div>
                          </div>
                        ) : dialectTranslation ? (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8"
                          >
                            <div className="glass p-10 rounded-[2.5rem] border border-line/50 space-y-6 relative overflow-hidden group">
                              <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/10 blur-[40px] rounded-full group-hover:bg-accent/20 transition-colors" />
                              <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-accent/10 rounded-2xl">
                                  <Radio className="w-6 h-6 text-accent" />
                                </div>
                                <div>
                                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Regional Synthesis</h3>
                                  <p className="text-2xl font-black tracking-tighter uppercase text-white">{selectedDialect} Dialect</p>
                                </div>
                              </div>
                              <div className="p-8 bg-bg/30 rounded-3xl border border-line/30">
                                <p className="text-3xl leading-relaxed font-black tracking-tight text-white">{dialectTranslation.translated_text}</p>
                              </div>
                            </div>

                            <div className="glass p-10 rounded-[2.5rem] border border-line/50 border-dashed space-y-6 relative overflow-hidden group">
                              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full" />
                              <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-blue-500/10 rounded-2xl">
                                  <Smartphone className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Audio Phonetics</h3>
                                  <p className="text-2xl font-black tracking-tighter uppercase text-white">Pronunciation Guide</p>
                                </div>
                              </div>
                              <div className="p-8 bg-bg/30 rounded-3xl border border-line/30">
                                <p className="font-mono text-xl italic text-white/70 tracking-tight">{dialectTranslation.phonetic_pronunciation}</p>
                              </div>
                              <div className="pt-6 border-t border-line/30">
                                <div className="flex items-center gap-3 text-muted">
                                  <Info className="w-4 h-4" />
                                  <p className="text-[9px] font-black uppercase tracking-widest leading-loose">
                                    AI-Generated Synthesis for localized ground-truth communication. 
                                    Prioritize regional accessibility for high-risk zones.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="text-center space-y-6 opacity-30">
                            <Languages className="w-20 h-20 mx-auto" />
                            <p className="text-xl font-black tracking-tighter uppercase">Select Dialect for Synthesis</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

          {viewMode === 'profile' && (
                    <div className="max-w-7xl mx-auto w-full space-y-12">
                      {/* Bluetooth Mesh Sharing Section */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-10 rounded-[2.5rem] border border-line/50 shadow-2xl relative overflow-hidden"
                      >
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                          <div className="space-y-4 text-center lg:text-left">
                            <div className="flex items-center gap-4 justify-center lg:justify-start">
                              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border transition-all", bluetoothEnabled ? "bg-accent/20 border-accent text-accent shadow-[0_0_20px_rgba(255,107,0,0.3)]" : "bg-bg/50 border-line/50 text-muted")}>
                                <Zap className={cn("w-6 h-6", bluetoothEnabled && "animate-pulse")} />
                              </div>
                              <h3 className="text-3xl font-black tracking-tighter uppercase">Offline Mesh Relay</h3>
                            </div>
                            <p className="text-sm text-muted max-w-xl">
                              Enable Bluetooth Mesh to automatically share critical alerts with nearby users even when cellular networks are down. Your device acts as a relay node in the SafeSignal network.
                            </p>
                          </div>
                          
                          <button 
                            onClick={toggleBluetoothMesh}
                            className={cn(
                              "px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-4",
                              bluetoothEnabled 
                                ? "bg-accent text-bg shadow-lg shadow-accent/20" 
                                : "bg-white/5 border border-line/50 text-white hover:bg-white/10"
                            )}
                          >
                            {bluetoothEnabled ? 'Mesh Active' : 'Activate Mesh'}
                            <div className={cn("w-2 h-2 rounded-full", bluetoothEnabled ? "bg-bg animate-ping" : "bg-muted")} />
                          </button>
                        </div>

                        {bluetoothEnabled && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-10 pt-10 border-t border-line/30"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                              <div className="p-6 bg-bg/50 rounded-2xl border border-line/30 flex flex-col items-center text-center">
                                <Globe className="w-8 h-8 text-accent mb-4 animate-spin-slow" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">Network Status</p>
                                <p className="text-xs font-black text-white">RELAYING ACTIVE</p>
                              </div>
                              {discoveredNodes.map(node => (
                                <div key={node} className="p-6 bg-bg/50 rounded-2xl border border-line/30 flex flex-col items-center text-center group hover:border-accent transition-all">
                                  <Smartphone className="w-8 h-8 text-muted group-hover:text-accent mb-4" />
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">Nearby Node</p>
                                  <p className="text-xs font-black text-white uppercase">{node}</p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                      {user && userProfile && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="glass p-10 rounded-[2.5rem] border border-line/50 shadow-2xl relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-8 opacity-5">
                            <UserIcon className="w-64 h-64" />
                          </div>
                          
                          <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center lg:items-start">
                            <div className="relative group">
                              <div className="w-32 h-32 bg-accent/10 border-2 border-accent/30 flex items-center justify-center rounded-3xl group-hover:border-accent transition-all duration-500">
                                <span className="text-5xl font-black tracking-tighter text-accent">{userProfile.displayName?.charAt(0) || 'U'}</span>
                              </div>
                              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-success rounded-full border-4 border-bg flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            
                            <div className="flex-1 space-y-8 text-center lg:text-left">
                              <div>
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-2">
                                  <h3 className="text-5xl font-black tracking-tighter uppercase">{userProfile.displayName || 'Anonymous Node'}</h3>
                                  <span className="px-3 py-1 bg-accent/10 border border-accent/30 text-[10px] font-black uppercase tracking-widest text-accent rounded-full w-fit mx-auto lg:mx-0">
                                    VERIFIED OPERATOR
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-muted uppercase tracking-widest">{userProfile.email}</p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-8 border-t border-line/30">
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted">Primary Interface</p>
                                  <div className="flex items-center gap-3 justify-center lg:justify-start">
                                    <div className="p-2 bg-bg/50 rounded-lg border border-line/30">
                                      <Languages className="w-4 h-4 text-accent" />
                                    </div>
                                    <span className="font-black uppercase tracking-widest text-xs">{userProfile.language || 'English'}</span>
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted">Communication Channel</p>
                                  <div className="flex items-center gap-3 justify-center lg:justify-start">
                                    <div className="p-2 bg-bg/50 rounded-lg border border-line/30">
                                      <Phone className="w-4 h-4 text-accent" />
                                    </div>
                                    <span className="font-black uppercase tracking-widest text-xs">{userProfile.phone || 'No Phone Linked'}</span>
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                                    {userProfile.vulnerability && userProfile.vulnerability.length > 0 ? (
                                      userProfile.vulnerability.map(v => (
                                        <span key={v} className="px-3 py-1 bg-bg/50 border border-line/30 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2">
                                          <Accessibility className="w-3 h-3 text-accent" />
                                          {v}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] font-black uppercase tracking-widest text-muted italic">Standard Profile</span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted">Node Activation</p>
                                  <div className="flex items-center gap-3 justify-center lg:justify-start">
                                    <div className="p-2 bg-bg/50 rounded-lg border border-line/30">
                                      <History className="w-4 h-4 text-accent" />
                                    </div>
                                    <span className="font-black uppercase tracking-widest text-xs">
                                      {userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-row lg:flex-col gap-3 w-full lg:w-auto">
                              <button 
                                onClick={() => setViewMode('settings')}
                                className="flex-1 lg:w-48 py-4 bg-bg/50 border border-line/50 hover:border-accent text-[10px] font-black uppercase tracking-widest transition-all rounded-2xl flex items-center justify-center gap-3"
                              >
                                <Settings className="w-4 h-4" />
                                Configure Node
                              </button>
                              <button 
                                onClick={() => auth.signOut()}
                                className="flex-1 lg:w-48 py-4 bg-danger/10 border border-danger/30 hover:bg-danger/20 text-danger text-[10px] font-black uppercase tracking-widest transition-all rounded-2xl flex items-center justify-center gap-3"
                              >
                                <LogOut className="w-4 h-4" />
                                Terminate Session
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <motion.div 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="lg:col-span-2 glass rounded-[2.5rem] border border-line/50 overflow-hidden group"
                        >
                          <div className="aspect-video relative overflow-hidden">
                            <img 
                              src={selectedRegion.image_url} 
                              alt={selectedRegion.name}
                              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 p-10 w-full">
                              <div className="flex justify-between items-end">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent mb-2">Sector Intelligence</p>
                                  <h3 className="text-5xl font-black tracking-tighter uppercase text-bg">{selectedRegion.name}</h3>
                                  <p className="text-xl font-bold text-bg/60 uppercase tracking-widest">{selectedRegion.name_bn}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-2">Primary Hazard</p>
                                  <div className="flex items-center gap-3 justify-end">
                                    <span className="text-2xl font-black tracking-tighter text-bg uppercase">{selectedRegion.primary_hazard}</span>
                                    <div className="p-3 bg-accent rounded-2xl">
                                      {getHazardIcon(selectedRegion.primary_hazard)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Sector Specialty</p>
                              <div className="p-6 bg-bg/30 rounded-2xl border border-line/30">
                                <p className="text-lg font-bold italic serif text-white/80">"{selectedRegion.specialty}"</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Node Identification</p>
                              <div className="p-6 bg-bg/30 rounded-2xl border border-line/30 flex items-center justify-between">
                                <span className="text-3xl font-black tracking-tighter text-accent">{selectedRegion.id.toUpperCase()}</span>
                                <div className="w-12 h-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="glass rounded-[2.5rem] border border-line/50 p-10 space-y-8"
                        >
                          <div className="flex items-center gap-4 border-b border-line/30 pb-6">
                            <div className="p-3 bg-accent/10 rounded-2xl">
                              <Users className="w-6 h-6 text-accent" />
                            </div>
                            <h3 className="text-2xl font-black tracking-tighter uppercase">Ground Truth</h3>
                          </div>

                          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {communityFeedback.length > 0 ? (
                              communityFeedback.map((fb, idx) => (
                                <motion.div 
                                  key={idx}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.1 }}
                                  className="p-6 bg-bg/30 rounded-3xl border border-line/30 space-y-4 hover:border-accent/30 transition-colors"
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star 
                                          key={star} 
                                          className={cn(
                                            "w-3 h-3", 
                                            fb.accuracy >= star ? "text-accent fill-current" : "text-line"
                                          )} 
                                        />
                                      ))}
                                    </div>
                                    <span className="text-[9px] font-black text-muted uppercase tracking-widest">
                                      {new Date(fb.timestamp).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm font-bold italic text-white/80">"{fb.comments || "No specific observation provided."}"</p>
                                  <div className="pt-4 border-t border-line/30 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 bg-accent/10 rounded-full flex items-center justify-center">
                                        <UserIcon className="w-3 h-3 text-accent" />
                                      </div>
                                      <span className="text-[9px] font-black uppercase tracking-widest text-muted">Verified Node</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-success">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span className="text-[9px] font-black uppercase">Sync OK</span>
                                    </div>
                                  </div>
                                </motion.div>
                              ))
                            ) : (
                              <div className="py-20 text-center space-y-4 opacity-30">
                                <BrainCircuit className="w-12 h-12 mx-auto" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No Active Intelligence</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  )}

                  {viewMode === 'datacenter' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-7xl mx-auto w-full space-y-8"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-8 bg-accent rounded-full" />
                            <h2 className="text-4xl font-black tracking-tighter uppercase">Central Data Node</h2>
                          </div>
                          <p className="col-header !text-muted">Multi-Agency Telemetry // BMD, BWDB, FFWC, DAE, CPP Integration</p>
                        </div>
                        <div className="flex gap-4 glass p-2 rounded-xl border border-line/50">
                           <div className="flex items-center gap-2 px-3 py-1">
                             <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                             <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">System Online</span>
                           </div>
                           <div className="w-px h-4 bg-line/30 self-center" />
                           <div className="flex items-center gap-2 px-3 py-1">
                             <Database className="w-3 h-3 text-accent" />
                             <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">Node: BD-MAIN-01</span>
                           </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-8">
                        <button 
                          onClick={() => setDataCenterTab('telemetry')}
                          className={cn(
                            "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                            dataCenterTab === 'telemetry' ? "bg-accent border-accent text-bg shadow-lg shadow-accent/20" : "bg-bg/50 border-line/50 text-muted hover:border-accent/50"
                          )}
                        >
                          Telemetry Uplink
                        </button>
                        <button 
                          onClick={() => setDataCenterTab('feedback')}
                          className={cn(
                            "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                            dataCenterTab === 'feedback' ? "bg-accent border-accent text-bg shadow-lg shadow-accent/20" : "bg-bg/50 border-line/50 text-muted hover:border-accent/50"
                          )}
                        >
                          Feedback Analysis
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Column: Data Entry or Feedback Stats */}
                        <div className="lg:col-span-5 space-y-8">
                          {dataCenterTab === 'telemetry' ? (
                            <div className="glass p-8 rounded-3xl border border-line/50 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] rounded-full" />
                              
                              <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-3">
                                <Upload className="w-5 h-5 text-accent" />
                                Telemetry Uplink
                              </h3>

                              {!user ? (
                                <div className="p-12 border border-dashed border-line/30 rounded-2xl text-center bg-bg/20">
                                  <Lock className="w-10 h-10 mx-auto mb-4 text-muted/50" />
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-6">Security Clearance Required</p>
                                  <button 
                                    onClick={() => setViewMode('auth')}
                                    className="px-8 py-3 bg-white text-bg text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent transition-all"
                                  >
                                    Authenticate
                                  </button>
                                </div>
                              ) : (
                                <form onSubmit={handleUpload} className="space-y-6">
                                  <div className="flex flex-wrap p-1 bg-bg/50 rounded-xl border border-line/30 gap-1">
                                    {[
                                      { id: 'bmb', label: 'BMD' },
                                      { id: 'bwdb', label: 'BWDB' },
                                      { id: 'ffwc', label: 'FFWC' },
                                      { id: 'dae', label: 'DAE' },
                                      { id: 'cpp', label: 'CPP' }
                                    ].map((type) => (
                                      <button 
                                        key={type.id}
                                        type="button"
                                        onClick={() => setUploadType(type.id as any)}
                                        className={cn(
                                          "flex-1 min-w-[60px] py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                          uploadType === type.id ? "bg-accent text-bg shadow-lg" : "text-muted hover:text-white"
                                        )}
                                      >
                                        {type.label}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Target Sector</label>
                                      <select 
                                        className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-bold uppercase tracking-widest text-[11px] appearance-none cursor-pointer"
                                        value={selectedRegion.id}
                                        onChange={e => {
                                          const region = BANGLADESH_REGIONS.find(r => r.id === e.target.value);
                                          if (region) setSelectedRegion(region);
                                        }}
                                      >
                                        {BANGLADESH_REGIONS.map(r => (
                                          <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {uploadType === 'bmb' && (
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Surface Temp (°C)</label>
                                          <input 
                                            type="number" step="0.1" required
                                            value={uploadData.temp}
                                            onChange={e => setUploadData({...uploadData, temp: e.target.value})}
                                            className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                            placeholder="00.0"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Precipitation (mm)</label>
                                          <input 
                                            type="number" step="0.1" required
                                            value={uploadData.rain}
                                            onChange={e => setUploadData({...uploadData, rain: e.target.value})}
                                            className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                            placeholder="00.0"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {(uploadType === 'bwdb' || uploadType === 'ffwc') && (
                                      <div className="space-y-4">
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Water Level (m)</label>
                                          <input 
                                            type="number" step="0.01" required
                                            value={uploadData.water}
                                            onChange={e => setUploadData({...uploadData, water: e.target.value})}
                                            className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                            placeholder="0.00"
                                          />
                                        </div>
                                        {uploadType === 'ffwc' && (
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                              <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Discharge (m³/s)</label>
                                              <input 
                                                type="number" step="0.1" required
                                                value={uploadData.discharge}
                                                onChange={e => setUploadData({...uploadData, discharge: e.target.value})}
                                                className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                                placeholder="0.0"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Danger Level (m)</label>
                                              <input 
                                                type="number" step="0.01" required
                                                value={uploadData.dangerLevel}
                                                onChange={e => setUploadData({...uploadData, dangerLevel: e.target.value})}
                                                className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                                placeholder="0.00"
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {uploadType === 'dae' && (
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Crop Type</label>
                                            <input 
                                              type="text" required
                                              value={uploadData.cropType}
                                              onChange={e => setUploadData({...uploadData, cropType: e.target.value})}
                                              className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-bold uppercase tracking-widest text-[11px]"
                                              placeholder="e.g. AMAN RICE"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Soil Moisture (%)</label>
                                            <input 
                                              type="number" step="1" required
                                              value={uploadData.soilMoisture}
                                              onChange={e => setUploadData({...uploadData, soilMoisture: e.target.value})}
                                              className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                              placeholder="00"
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Agricultural Advice (EN)</label>
                                          <textarea 
                                            required
                                            value={uploadData.advice_en}
                                            onChange={e => setUploadData({...uploadData, advice_en: e.target.value})}
                                            className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none text-xs min-h-[80px]"
                                            placeholder="Enter advice for farmers..."
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {uploadType === 'cpp' && (
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Signal Level (1-10)</label>
                                            <input 
                                              type="number" min="1" max="10" required
                                              value={uploadData.signalLevel}
                                              onChange={e => setUploadData({...uploadData, signalLevel: e.target.value})}
                                              className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                              placeholder="1"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Evacuation %</label>
                                            <input 
                                              type="number" min="0" max="100" required
                                              value={uploadData.evacuationProgress}
                                              onChange={e => setUploadData({...uploadData, evacuationProgress: e.target.value})}
                                              className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                              placeholder="0"
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-bold uppercase text-muted tracking-widest ml-1">Active Volunteers</label>
                                          <input 
                                            type="number" required
                                            value={uploadData.volunteersActive}
                                            onChange={e => setUploadData({...uploadData, volunteersActive: e.target.value})}
                                            className="w-full p-4 bg-bg/60 border border-line/50 rounded-xl focus:border-accent outline-none font-mono text-sm"
                                            placeholder="0"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <button 
                                    type="submit"
                                    disabled={uploading}
                                    className="w-full py-4 bg-accent text-bg font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-white transition-all shadow-[0_0_20px_rgba(255,107,0,0.2)] disabled:opacity-50"
                                  >
                                    {uploading ? "Transmitting..." : "Execute Data Uplink"}
                                  </button>

                                  {uploadSuccess && (
                                    <motion.p 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="text-center text-success text-[10px] font-bold uppercase tracking-widest"
                                    >
                                      Transmission Successful // Node Updated
                                    </motion.p>
                                  )}
                                </form>
                              )}
                            </div>
                          ) : (
                            <div className="glass p-8 rounded-3xl border border-line/50 relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[60px] rounded-full" />
                               <h3 className="text-xl font-black tracking-tighter uppercase mb-8 flex items-center gap-3">
                                  <Star className="w-5 h-5 text-accent" />
                                  Feedback Analysis
                               </h3>

                               <div className="space-y-8">
                                  <div className="grid grid-cols-2 gap-4">
                                     <div className="p-6 bg-bg/50 border border-line/30 rounded-2xl">
                                        <p className="col-header !text-[8px] mb-2">Avg Accuracy</p>
                                        <p className="text-3xl font-black text-white">{feedbackStats.avgAccuracy}<span className="text-xs opacity-40">/5</span></p>
                                     </div>
                                     <div className="p-6 bg-bg/50 border border-line/30 rounded-2xl">
                                        <p className="col-header !text-[8px] mb-2">Avg Utility</p>
                                        <p className="text-3xl font-black text-white">{feedbackStats.avgUsefulness}<span className="text-xs opacity-40">/5</span></p>
                                     </div>
                                  </div>

                                  <div className="p-6 bg-accent/5 border border-accent/20 rounded-2xl">
                                     <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">System Health</p>
                                     <p className="text-xs text-white/80 leading-relaxed italic">
                                        {feedbackStats.avgAccuracy >= 4 ? "Models are performing within nominal parameters. Ground truth correlates with satellite telemetry." : 
                                         feedbackStats.avgAccuracy >= 3 ? "Minor divergence detected. Model recalibration recommended for localized anomalies." :
                                         feedbackStats.totalFeedback > 0 ? "Significant divergence detected. Immediate manual review of risk weights required." :
                                         "Insufficient community data for automated health assessment."}
                                     </p>
                                  </div>

                                  <div className="space-y-4">
                                     <p className="col-header !text-[9px] uppercase tracking-widest text-muted">Recent Ground Truths</p>
                                     <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {communityFeedback.map((fb, idx) => (
                                           <div key={idx} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                              <div className="flex justify-between items-start mb-2">
                                                 <div className="flex gap-0.5">
                                                    {[1,2,3,4,5].map(s => <Star key={s} className={cn("w-2 h-2", fb.accuracy >= s ? "text-accent fill-current" : "text-muted")} />)}
                                                 </div>
                                                 <span className="text-[8px] font-mono text-muted">{new Date(fb.timestamp).toLocaleDateString()}</span>
                                              </div>
                                              <p className="text-[11px] text-white/70 italic">"{fb.comments || "No comment"}"</p>
                                           </div>
                                        ))}
                                     </div>
                                  </div>
                               </div>
                            </div>
                          )}
                        </div>

                        {/* Right Column: Visualization & History */}
                        <div className="lg:col-span-7 space-y-8">
                          <div className="glass p-8 rounded-3xl border border-line/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full" />
                            
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3">
                                <Activity className="w-5 h-5 text-blue-400" />
                                Historical Telemetry
                              </h3>
                              <div className="flex gap-2">
                                <span className="px-2 py-1 bg-bg/50 border border-line/30 rounded text-[8px] font-bold uppercase tracking-widest text-muted">BMB-01</span>
                                <span className="px-2 py-1 bg-bg/50 border border-line/30 rounded text-[8px] font-bold uppercase tracking-widest text-muted">UTC-6</span>
                              </div>
                            </div>

                            <div className="h-[350px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={(
                                  uploadType === 'bmb' ? historicalBMBData :
                                  uploadType === 'bwdb' ? historicalBWDBData :
                                  uploadType === 'ffwc' ? historicalFFWCData :
                                  uploadType === 'dae' ? historicalDAEData :
                                  historicalCPPData
                                ) as any[]}>
                                  <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#FF6B00" stopOpacity={0.8}/>
                                      <stop offset="100%" stopColor="#FF6B00" stopOpacity={0.2}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.05} vertical={false} />
                                  <XAxis 
                                    dataKey="timestamp" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#8E9299', fontWeight: 600 }}
                                    tickFormatter={(str) => new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  />
                                  <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#8E9299', fontWeight: 600 }}
                                  />
                                  <Tooltip 
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        return (
                                          <div className="glass p-3 border border-line/50 rounded-xl shadow-2xl">
                                            <p className="text-[9px] font-bold uppercase text-muted tracking-widest mb-1">
                                              {new Date(payload[0].payload.timestamp).toLocaleString()}
                                            </p>
                                            <p className="text-lg font-black tracking-tighter">
                                              {payload[0].value} {
                                                uploadType === 'bmb' ? '°C' :
                                                uploadType === 'bwdb' || uploadType === 'ffwc' ? 'm' :
                                                uploadType === 'dae' ? '%' :
                                                'Signal'
                                              }
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar 
                                    dataKey={
                                      uploadType === 'bmb' ? 'temperature' :
                                      uploadType === 'bwdb' || uploadType === 'ffwc' ? 'waterLevel' :
                                      uploadType === 'dae' ? 'soilMoisture' :
                                      'signalLevel'
                                    } 
                                    radius={[4, 4, 0, 0]} 
                                    fill="url(#barGradient)" 
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-line/30 pt-6">
                              {[
                                { label: 'Critical', color: 'bg-danger', range: '>35°C' },
                                { label: 'Warning', color: 'bg-warning', range: '30-35°C' },
                                { label: 'Elevated', color: 'bg-accent', range: '25-30°C' },
                                { label: 'Nominal', color: 'bg-success', range: '<25°C' }
                              ].map((item, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/70">{item.label}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-muted pl-3">{item.range}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Recent Submissions Grid */}
                          <div className="glass p-8 rounded-3xl border border-line/50">
                             <h3 className="text-xl font-black tracking-tighter uppercase mb-6 flex items-center gap-3">
                                <Database className="w-5 h-5 text-success" />
                                Recent Ingestions
                             </h3>
                             <div className="space-y-2 overflow-x-auto">
                                <div className="min-w-[400px]">
                                  <div className="grid grid-cols-4 px-4 py-2 border-b border-line/30">
                                     <span className="col-header !text-[8px]">Timestamp</span>
                                     <span className="col-header !text-[8px]">Sector</span>
                                     <span className="col-header !text-[8px]">Metric</span>
                                     <span className="col-header !text-[8px] text-right">Value</span>
                                  </div>
                                  {(uploadType === 'bmb' ? historicalBMBData :
                                      uploadType === 'bwdb' ? historicalBWDBData :
                                      uploadType === 'ffwc' ? historicalFFWCData :
                                      uploadType === 'dae' ? historicalDAEData :
                                      historicalCPPData).slice(0, 5).map((data: any, i) => (
                                     <div key={i} className="grid grid-cols-4 px-4 py-3 hover:bg-white/5 transition-colors rounded-lg group cursor-pointer">
                                        <span className="text-[10px] font-mono text-muted self-center">
                                           {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest self-center">
                                           {BANGLADESH_REGIONS.find(r => r.id === data.districtId)?.name || 'Unknown'}
                                        </span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted self-center">
                                          {uploadType === 'bmb' ? 'Temperature' : 
                                           uploadType === 'bwdb' || uploadType === 'ffwc' ? 'Water Level' :
                                           uploadType === 'dae' ? 'Soil Moisture' : 'Signal Level'}
                                        </span>
                                        <span className="text-[10px] font-black text-right self-center text-accent">
                                          {uploadType === 'bmb' ? `${data.temperature}°C` :
                                           uploadType === 'bwdb' || uploadType === 'ffwc' ? `${data.waterLevel}m` :
                                           uploadType === 'dae' ? `${data.soilMoisture}%` : `Signal ${data.signalLevel}`}
                                        </span>
                                     </div>
                                  ))}
                                </div>
                             </div>
                          </div>

                          {/* Model Improvement Section */}
                          <div className="glass p-8 rounded-3xl border border-line/50 space-y-6">
                            <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3">
                              <BrainCircuit className="w-5 h-5 text-accent" />
                              ML Model Improvement
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-bg/40 rounded-2xl border border-line/30">
                                <span className="text-[9px] font-bold uppercase text-muted tracking-widest block mb-1">Feedback Points</span>
                                <span className="text-2xl font-black text-accent">{feedbackCount}</span>
                              </div>
                              <div className="p-4 bg-bg/40 rounded-2xl border border-line/30">
                                <span className="text-[9px] font-bold uppercase text-muted tracking-widest block mb-1">False Reports</span>
                                <span className="text-2xl font-black text-danger">{falseAlertCount}</span>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-muted">Model Accuracy</span>
                                <span className="text-success">98.4% (+0.2%)</span>
                              </div>
                              <div className="h-2 bg-bg/60 rounded-full overflow-hidden border border-line/30">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: '98.4%' }}
                                  className="h-full bg-success"
                                />
                              </div>
                            </div>

                            <div className="pt-4 border-t border-line/30 space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold uppercase text-muted tracking-widest">Last Recalibration</span>
                                <span className="text-[9px] font-mono text-white/70">
                                  {lastRetrained ? new Date(lastRetrained).toLocaleString() : 'Never'}
                                </span>
                              </div>
                              <button 
                                onClick={handleRetrainModel}
                                disabled={isRetraining || (feedbackCount === 0 && falseAlertCount === 0)}
                                className="w-full py-4 bg-white text-bg font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-accent hover:text-bg transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                              >
                                {isRetraining ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                                    Training...
                                  </>
                                ) : (
                                  <>
                                    <Cpu className="w-4 h-4" />
                                    Trigger Model Retraining
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Feedback & Reporting Section */}
                          <div className="mt-10 pt-8 border-t border-line space-y-8">
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Community Intelligence</h4>
                              <FeedbackSystem 
                                alertId={alert?.id || "MANUAL_TEST"} 
                                regionId={selectedRegion.id} 
                              />
                            </div>
                            
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-danger">Ground Truth Verification</h4>
                              <FalseAlertReport 
                                alertId={alert?.id || "MANUAL_TEST"} 
                                onClose={() => {}} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {viewMode === 'districts' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-7xl mx-auto w-full space-y-12"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="text-left">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-8 bg-accent rounded-full" />
                            <h2 className="text-4xl font-black tracking-tighter uppercase">Sector Directory</h2>
                          </div>
                          <p className="col-header !text-muted">64 Administrative Nodes // Bangladesh Territory</p>
                        </div>
                        
                        <div className="w-full md:w-96 relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
                          <input 
                            type="text"
                            placeholder="SEARCH SECTOR..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-black uppercase tracking-widest text-[10px] transition-all"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {BANGLADESH_REGIONS.filter(r => 
                          r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.name_bn.includes(searchQuery)
                        ).map((region) => (
                          <motion.div 
                            key={region.id}
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="glass p-6 rounded-3xl border border-line/50 flex flex-col justify-between h-[300px] transition-all cursor-pointer group relative overflow-hidden"
                            onClick={() => {
                              setSelectedRegion(region);
                              setViewMode('profile');
                            }}
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] rounded-full group-hover:bg-accent/10 transition-colors" />
                            
                            <div className="relative z-10">
                              <div className="flex justify-between items-start mb-6">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-muted mb-1">
                                    NODE: {region.id.toUpperCase()}
                                  </span>
                                  <span className="px-2 py-0.5 bg-bg/50 border border-line/30 text-[8px] font-bold uppercase tracking-widest rounded w-fit">
                                    {region.id.split('-')[0].toUpperCase()}
                                  </span>
                                </div>
                                <div className="p-2 bg-bg/50 rounded-lg border border-line/30 group-hover:border-accent transition-colors">
                                  {getHazardIcon(region.primary_hazard)}
                                </div>
                              </div>
                              <h3 className="text-3xl font-black tracking-tighter uppercase mb-1 group-hover:text-accent transition-colors">
                                {region.name}
                              </h3>
                              <p className="text-xs font-bold text-muted uppercase tracking-widest">{region.name_bn}</p>
                            </div>
                            
                            <div className="relative z-10 space-y-4 pt-6 border-t border-line/30">
                              <div className="flex justify-between items-center">
                                <p className="text-[8px] uppercase font-black text-muted tracking-widest">Primary Hazard</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-accent">{region.primary_hazard}</p>
                              </div>
                              <div className="flex justify-between items-center">
                                <p className="text-[8px] uppercase font-black text-muted tracking-widest">Specialty</p>
                                <p className="text-[9px] font-bold text-white/70 line-clamp-1">{region.specialty}</p>
                              </div>
                              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-muted group-hover:text-white transition-colors">
                                View Full Profile <ArrowRight className="w-3 h-3" />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {viewMode === 'settings' && user && userProfile && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto w-full"
              >
                <div className="glass p-10 rounded-[2.5rem] border border-line/50 shadow-2xl relative overflow-hidden">
                  <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Settings className="w-8 h-8 text-accent" />
                    </div>
                    <h3 className="text-4xl font-black tracking-tighter uppercase mb-2">Node Configuration</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Update Operator Identity & Communication Protocols</p>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      await setDoc(doc(db, 'users', user.uid), {
                        displayName,
                        phone,
                        language: selectedLanguage,
                        vulnerability: vulnerabilities,
                        mobileRotationMode
                      }, { merge: true });
                      toast.success("Profile Updated", { description: "Operator identity synchronized with central command." });
                      setViewMode('profile');
                    } catch (err) {
                      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
                      toast.error("Update Failed", { description: "Failed to synchronize profile data." });
                    } finally {
                      setLoading(false);
                    }
                  }} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Display Name</label>
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="w-full px-6 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-bold text-sm transition-all"
                        placeholder="OPERATOR_NAME"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Phone Number (for SMS/Voice Alerts)</label>
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full px-6 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-bold text-sm transition-all"
                        placeholder="+8801XXXXXXXXX"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Primary Language</label>
                      <select 
                        value={selectedLanguage}
                        onChange={e => setSelectedLanguage(e.target.value as Language)}
                        className="w-full px-6 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-bold text-sm transition-all appearance-none"
                      >
                        <option value="English">English</option>
                        <option value="Bangla">Bangla</option>
                      </select>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-line/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">Mobile Rotated Mode</p>
                          <p className="text-[8px] uppercase font-bold text-muted">Optimized landscape view for mobile devices</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setMobileRotationMode(!mobileRotationMode)}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            mobileRotationMode ? "bg-accent" : "bg-line"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            mobileRotationMode ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        type="button"
                        onClick={() => setViewMode('profile')}
                        className="flex-1 py-5 bg-bg/50 border border-line/50 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-5 bg-accent text-bg font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                      >
                        {loading ? 'Synchronizing...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {viewMode === 'auth' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="max-w-md mx-auto w-full"
                    >
                      <div className="glass p-10 rounded-[2.5rem] border border-line/50 shadow-2xl relative overflow-hidden">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent/10 blur-[80px] rounded-full" />
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full" />
                        
                        {/* Onboarding Progress */}
                        {authMode === 'signup' && (
                          <div className="flex justify-center gap-2 mb-8">
                            {[0, 1, 2, 3].map((step) => (
                              <div 
                                key={step} 
                                className={cn(
                                  "h-1 rounded-full transition-all duration-500",
                                  onboardingStep === step ? "w-8 bg-accent" : "w-4 bg-line"
                                )}
                              />
                            ))}
                          </div>
                        )}

                        {/* Step 0: Language Selection */}
                        {authMode === 'signup' && onboardingStep === 0 && (
                          <div className="relative z-10 space-y-8">
                            <div className="text-center">
                              <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Languages className="w-8 h-8 text-accent" />
                              </div>
                              <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">Choose Language</h3>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Select your preferred communication protocol</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              {['English', 'Bangla'].map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => {
                                    setSelectedLanguage(lang as Language);
                                    setOnboardingStep(1);
                                  }}
                                  className={cn(
                                    "p-6 rounded-2xl border transition-all text-left flex items-center justify-between group",
                                    selectedLanguage === lang 
                                      ? "bg-accent border-accent text-bg" 
                                      : "bg-bg/50 border-line/50 text-white hover:border-accent"
                                  )}
                                >
                                  <span className="text-lg font-black uppercase tracking-tighter">{lang}</span>
                                  <ChevronRight className={cn("w-5 h-5", selectedLanguage === lang ? "text-bg" : "text-muted group-hover:text-accent")} />
                                </button>
                              ))}
                            </div>
                            <button 
                              onClick={() => setAuthMode('login')}
                              className="w-full text-[10px] font-black uppercase tracking-widest text-muted hover:text-white transition-colors"
                            >
                              Already have an identity? Access Portal
                            </button>
                          </div>
                        )}

                        {/* Step 1: Auth (Login/Signup) */}
                        {(authMode === 'login' || (authMode === 'signup' && onboardingStep === 1)) && (
                          <div className="relative z-10">
                            <div className="text-center mb-10">
                              <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <ShieldCheck className="w-8 h-8 text-accent" />
                              </div>
                              <h3 className="text-4xl font-black tracking-tighter uppercase mb-2">
                                {authMode === 'login' ? 'Access Portal' : 'Identity Setup'}
                              </h3>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                                {authMode === 'login' ? 'Secure Uplink Authorization Required' : 'Phase 01: Authentication Protocol'}
                              </p>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-5">
                              {!showOtpStep ? (
                                <>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Email Address</label>
                                      <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
                                        <input 
                                          type="email" 
                                          required
                                          value={email}
                                          onChange={e => setEmail(e.target.value)}
                                          className="w-full pl-12 pr-4 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-bold text-sm transition-all"
                                          placeholder="COMM_CHANNEL..."
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Access Key</label>
                                      <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
                                        <input 
                                          type="password" 
                                          required
                                          value={password}
                                          onChange={e => setPassword(e.target.value)}
                                          className="w-full pl-12 pr-4 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-bold text-sm transition-all"
                                          placeholder="••••••••"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <button 
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-5 bg-accent text-bg font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                                  >
                                    {loading ? (
                                      <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin mx-auto" />
                                    ) : (
                                      authMode === 'login' ? 'Authorize Uplink' : 'Initialize Identity'
                                    )}
                                  </button>

                                  <div className="relative py-4">
                                    <div className="absolute inset-0 flex items-center">
                                      <div className="w-full border-t border-line/30"></div>
                                    </div>
                                    <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest">
                                      <span className="bg-bg px-4 text-muted">Or Secure via External Provider</span>
                                    </div>
                                  </div>

                                  <button 
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    className="w-full py-4 bg-white/5 border border-line/50 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                                  >
                                    <Globe className="w-4 h-4 text-accent" />
                                    <span>Sign in with Google</span>
                                  </button>
                                </>
                              ) : (
                                <div className="space-y-6">
                                  <div className="text-center">
                                    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <Smartphone className="w-6 h-6 text-accent" />
                                    </div>
                                    <h4 className="text-lg font-black uppercase tracking-tighter">Verification Required</h4>
                                    <p className="text-[10px] font-bold text-muted mt-1 uppercase">A 6-digit code was sent to {email}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">OTP Code</label>
                                    <input 
                                      type="text" 
                                      required
                                      maxLength={6}
                                      value={otpCode}
                                      onChange={e => setOtpCode(e.target.value)}
                                      className="w-full px-4 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-black text-center text-2xl tracking-[0.5em] transition-all"
                                      placeholder="000000"
                                    />
                                  </div>
                                  <button 
                                    type="submit"
                                    disabled={isVerifying}
                                    className="w-full py-5 bg-accent text-bg font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white transition-all disabled:opacity-50"
                                  >
                                    {isVerifying ? (
                                      <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin mx-auto" />
                                    ) : (
                                      'Verify & Continue'
                                    )}
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setShowOtpStep(false)}
                                    className="w-full text-[10px] font-black uppercase tracking-widest text-muted hover:text-white transition-colors"
                                  >
                                    Back to Login
                                  </button>
                                </div>
                              )}
                            </form>

                            {authError && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-center gap-3"
                              >
                                <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                                <p className="text-[10px] font-bold text-danger uppercase">{authError}</p>
                              </motion.div>
                            )}

                            {!showOtpStep && (
                              <div className="mt-10 pt-10 border-t border-line/30 text-center">
                                <button 
                                  onClick={() => {
                                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                    setOnboardingStep(0);
                                  }}
                                  className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors"
                                >
                                  {authMode === 'login' ? "Don't have an identity? Register Node" : "Already have an identity? Access Portal"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Step 2: Profile Details */}
                        {authMode === 'signup' && onboardingStep === 2 && (
                          <div className="relative z-10 space-y-8">
                            <div className="text-center">
                              <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <UserIcon className="w-8 h-8 text-accent" />
                              </div>
                              <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">Profile Setup</h3>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Phase 02: Human Factor Indicators</p>
                            </div>
                            
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Display Name</label>
                                <input 
                                  type="text" 
                                  value={displayName}
                                  onChange={e => setDisplayName(e.target.value)}
                                  className="w-full px-4 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-bold text-sm transition-all"
                                  placeholder="YOUR NAME..."
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Vulnerability Indicators</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {['Elderly', 'Disabled', 'Children', 'Pregnant'].map((v) => (
                                    <button
                                      key={v}
                                      onClick={() => {
                                        setVulnerabilities(prev => 
                                          prev.includes(v as VulnerabilityIndicator) 
                                            ? prev.filter(x => x !== v) 
                                            : [...prev, v as VulnerabilityIndicator]
                                        );
                                      }}
                                      className={cn(
                                        "p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                                        vulnerabilities.includes(v as VulnerabilityIndicator)
                                          ? "bg-accent/20 border-accent text-accent"
                                          : "bg-bg/30 border-line/30 text-muted hover:border-line"
                                      )}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <button 
                              onClick={() => setOnboardingStep(3)}
                              disabled={!displayName}
                              className="w-full py-5 bg-accent text-bg font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white transition-all disabled:opacity-50"
                            >
                              Continue to Location
                            </button>
                          </div>
                        )}

                        {/* Step 3: Location Detection */}
                        {authMode === 'signup' && onboardingStep === 3 && (
                          <div className="relative z-10 space-y-8">
                            <div className="text-center">
                              <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <MapPin className="w-8 h-8 text-accent" />
                              </div>
                              <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">Location Sync</h3>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Phase 03: Geospatial Node Alignment</p>
                            </div>

                            <div className="space-y-6">
                              <button
                                onClick={detectLocation}
                                disabled={isDetectingLocation}
                                className="w-full p-8 rounded-3xl border border-accent/30 bg-accent/5 flex flex-col items-center gap-4 group hover:bg-accent/10 transition-all"
                              >
                                <div className={cn("w-12 h-12 rounded-full bg-accent flex items-center justify-center text-bg", isDetectingLocation && "animate-pulse")}>
                                  <Navigation className="w-6 h-6" />
                                </div>
                                <div className="text-center">
                                  <span className="text-sm font-black uppercase tracking-tighter block">Auto-Detect GPS</span>
                                  <span className="text-[9px] font-bold text-muted uppercase">Precision Satellite Uplink</span>
                                </div>
                              </button>

                              <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-line/30"></div>
                                </div>
                                <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.3em] text-muted bg-transparent">
                                  <span className="px-4 bg-[#050505]">OR MANUAL OVERRIDE</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted ml-2">Select District</label>
                                <select 
                                  value={selectedRegion.id}
                                  onChange={(e) => {
                                    const region = BANGLADESH_REGIONS.find(r => r.id === e.target.value);
                                    if (region) setSelectedRegion(region);
                                  }}
                                  className="w-full px-4 py-4 bg-bg/50 border border-line/50 rounded-2xl focus:border-accent outline-none font-bold text-sm transition-all appearance-none"
                                >
                                  {BANGLADESH_REGIONS.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <button 
                                onClick={() => setOnboardingStep(2)}
                                className="flex-1 py-5 bg-bg border border-line/50 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:border-white transition-all"
                              >
                                Back
                              </button>
                              <button 
                                onClick={() => handleAuth({ preventDefault: () => {} } as any)}
                                className="flex-[2] py-5 bg-accent text-bg font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white transition-all shadow-lg shadow-accent/20"
                              >
                                Complete Registration
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </main>

      {/* Footer */}
      <footer className="border-t border-line p-4 bg-ink text-bg flex justify-between items-center text-[10px] uppercase tracking-[0.2em]">
        <div className="flex gap-6">
          <span>BMD Integrated</span>
          <span>BWDB Verified</span>
          <span>CPP Protocol</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          Live Satellite Feed Active
        </div>
      </footer>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg/90 backdrop-blur-xl border-t border-line px-6 py-4 flex justify-between items-center z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        {NAV_ITEMS.filter(item => !item.adminOnly || userProfile?.role === 'admin').slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => setViewMode(item.id as any)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all",
              viewMode === item.id ? "text-accent scale-110" : "text-muted hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setViewMode('settings')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-all",
            viewMode === 'settings' ? "text-accent scale-110" : "text-muted hover:text-white"
          )}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-tighter">More</span>
        </button>
      </nav>
    </div>
  );
}
