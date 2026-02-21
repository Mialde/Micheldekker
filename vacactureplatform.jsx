import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc, 
  query, 
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  Plus, 
  Settings, 
  Eye, 
  EyeOff, 
  FileText, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Globe, 
  CheckCircle2, 
  CircleDashed, 
  XCircle, 
  Lock, 
  User, 
  LogOut, 
  ShieldCheck, 
  KeyRound, 
  ListChecks, 
  Gift, 
  Info, 
  Search, 
  Filter, 
  Coffee, 
  TrendingUp, 
  Users, 
  Smile, 
  Zap, 
  Image as ImageIcon, 
  Layers, 
  ShieldAlert, 
  Save, 
  UserPlus,
  LayoutDashboard,
  Award,
  Heart,
  Rocket,
  ArrowRight,
  Check,
  Tag
} from 'lucide-react';

// --- Firebase Configuratie ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'vacature-portal-frisson-v4';

const STATUS = {
  ACTIVE: 'actief',
  DRAFT: 'concept',
  INACTIVE: 'inactief'
};

const CATEGORIES = ['Alle Afdelingen', 'Productie', 'Facilitair', 'Kantoor', 'Logistiek'];

const PERMISSIONS = {
  MANAGE_VACANCIES: 'vacatures_beheren',
  MANAGE_USERS: 'gebruikers_beheren',
  MANAGE_ROLES: 'rollen_beheren',
  MANAGE_SETTINGS: 'instellingen_beheren'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('frontend'); 
  const [activeTab, setActiveTab] = useState('vacatures'); 
  const [selectedJob, setSelectedJob] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [vacancies, setVacancies] = useState([]);
  const [appUsers, setAppUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [siteSettings, setSiteSettings] = useState({
    heroImage: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80&w=2070',
    showHeroOverlay: true
  });

  // UI States
  const [modalType, setModalType] = useState(null); 
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle Afdelingen');

  // Login states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Form States
  const [vacancyForm, setVacancyForm] = useState({
    title: '', department: 'Productie', location: 'Dronten', type: 'Full-time',
    description: '', responsibilities: '', requirements: '', benefits: '',
    headerImage: '', status: STATUS.DRAFT
  });

  const [userForm, setUserForm] = useState({ username: '', password: '', roleId: '' });
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] });

  // RULE 3: Auth Before Queries
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Authenticatie mislukt:", err);
      }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribeAuth();
  }, []);

  // Real-time Data Listeners
  useEffect(() => {
    if (!user) return;

    // Zorg dat de admin altijd bestaat in deze sessie/omgeving
    const ensureBaseData = async () => {
      try {
        const adminRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_users', 'admin');
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, { username: 'admin', password: 'admin2024', roleId: 'super_admin' });
        }

        const roleRef = doc(db, 'artifacts', appId, 'public', 'data', 'roles', 'super_admin');
        const roleSnap = await getDoc(roleRef);
        if (!roleSnap.exists()) {
          await setDoc(roleRef, { name: 'Super Admin', permissions: Object.values(PERMISSIONS) });
        }
      } catch (e) {
        console.error("Base data init error:", e);
      }
    };
    ensureBaseData();

    // Listeners met error callbacks (verplicht)
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'site_config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) setSiteSettings(docSnap.data());
    }, (err) => console.error("Settings error:", err));

    const vacanciesRef = collection(db, 'artifacts', appId, 'public', 'data', 'vacancies');
    const unsubVacancies = onSnapshot(query(vacanciesRef), (snapshot) => {
      const jobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (jobs.length === 0 && !snapshot.metadata.fromCache) initializeFrissonData();
      setVacancies(jobs.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    }, (err) => console.error("Vacancies error:", err));

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'app_users');
    const unsubUsers = onSnapshot(query(usersRef), (snapshot) => {
      setAppUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Users error:", err));

    const rolesRef = collection(db, 'artifacts', appId, 'public', 'data', 'roles');
    const unsubRoles = onSnapshot(query(rolesRef), (snapshot) => {
      setRoles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Roles error:", err));

    return () => { unsubSettings(); unsubVacancies(); unsubUsers(); unsubRoles(); };
  }, [user]);

  const initializeFrissonData = async () => {
    const frissonJobs = [
      {
        title: 'Productbereider / Menger', department: 'Productie', location: 'Dronten', type: 'Full-time',
        description: 'Word de "chef" van onze cosmetica! Bij Frisson produceren we al ruim 35 jaar hoogwaardige cosmetica en reinigingsmiddelen voor bekende merken. Als productbereider ben je verantwoordelijk voor het hart van onze operatie: het nauwkeurig bereiden van batches volgens geheime recepturen.',
        responsibilities: '• Het nauwkeurig afwegen en mengen van grondstoffen volgens recept.\n• Bedienen van geavanceerde industriële mengmachines.\n• Uitvoeren van kwaliteitscontroles en pH-metingen.\n• Bewaken van de hygiëne- en veiligheidsprotocollen (GMP).',
        requirements: '• MBO werk- en denkniveau, bij voorkeur in een technische of chemische richting.\n• Een scherp oog voor detail.\n• Ervaring in een productieomgeving is een plus.',
        benefits: '• Uitstekend salaris.\n• Reiskostenvergoeding en pensioen.\n• Gezellige teamuitjes en warme familiecultuur.',
        headerImage: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&q=80&w=2000',
        status: STATUS.ACTIVE, createdAt: serverTimestamp()
      },
      {
        title: 'Facilitair Medewerker', department: 'Facilitair', location: 'Dronten', type: '16-24 uur',
        description: 'Jij bent het visitekaartje van Frisson! Als Facilitair Medewerker zorg je ervoor dat onze kantoren, kantines en presentatieruimtes er altijd tip-top uitzien. Bij een bedrijf dat cosmetica maakt, is uitstraling alles.',
        responsibilities: '• Het dagelijks onderhoud van kantoorruimtes en sanitaire voorzieningen.\n• Zorgen voor een gastvrije ontvangst in onze vergaderruimtes.\n• Beheer van facilitaire voorraden.',
        requirements: '• Je bent representatief, vriendelijk en servicegericht.\n• Je ziet werk liggen voordat anderen het zien.\n• Woonachtig in de omgeving van Dronten.',
        benefits: '• Flexibele uren.\n• Prettige en schone werkomgeving.\n• Goede secundaire arbeidsvoorwaarden.',
        headerImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000',
        status: STATUS.ACTIVE, createdAt: serverTimestamp()
      }
    ];
    const vacanciesRef = collection(db, 'artifacts', appId, 'public', 'data', 'vacancies');
    for (const job of frissonJobs) {
      try { await addDoc(vacanciesRef, job); } catch (e) { console.error(e); }
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = appUsers.find(u => u.username === loginUsername && u.password === loginPassword);
    if (foundUser) {
      setCurrentUserData(foundUser);
      setIsAuthorized(true);
      setView('backend');
      setLoginError('');
    } else {
      setLoginError('Onjuiste gebruikersnaam of wachtwoord.');
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    setCurrentUserData(null);
    setView('frontend');
    setLoginUsername('');
    setLoginPassword('');
  };

  const hasPermission = (perm) => {
    if (!currentUserData) return false;
    const userRole = roles.find(r => r.id === currentUserData.roleId);
    if (userRole?.id === 'super_admin') return true;
    return userRole?.permissions?.includes(perm);
  };

  const handleSaveVacancy = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'vacancies');
      if (editingItem) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vacancies', editingItem.id), { ...vacancyForm, updatedAt: serverTimestamp() });
      } else {
        await addDoc(ref, { ...vacancyForm, createdAt: serverTimestamp() });
      }
      setModalType(null);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!user || !userForm.username) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_users', userForm.username), userForm);
      setModalType(null);
      setUserForm({ username: '', password: '', roleId: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!user || !roleForm.name) return;
    try {
      const roleId = roleForm.name.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roles', roleId), roleForm);
      setModalType(null);
      setRoleForm({ name: '', permissions: [] });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredVacancies = useMemo(() => {
    return vacancies.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedCategory === 'Alle Afdelingen' || job.department === selectedCategory;
      return matchesSearch && matchesCat && job.status === STATUS.ACTIVE;
    });
  }, [vacancies, searchTerm, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 h-20">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setView('frontend')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-105 transition-transform">F</div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-slate-800 leading-none">Frisson</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mt-1">Careers</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6 text-sm font-bold">
            <button onClick={() => setView('frontend')} className={`hover:text-indigo-600 transition-colors ${view === 'frontend' || view === 'detail' ? 'text-indigo-600' : 'text-slate-500'}`}>Vacatures</button>
            <a href="#" className="text-slate-500 hover:text-indigo-600">Over Ons</a>
            {isAuthorized ? (
              <div className="flex items-center bg-slate-100 rounded-full p-1 pl-4 space-x-3">
                <span className="text-[10px] uppercase font-bold text-slate-500">{currentUserData.username}</span>
                <button onClick={() => setView('backend')} className={`px-4 py-2 rounded-full transition-all ${view === 'backend' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Dashboard</button>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600"><LogOut className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => setView('login')} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md">Admin</button>
            )}
          </div>
        </div>
      </nav>

      <main>
        {view === 'frontend' && (
          <>
            <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
              <img src={siteSettings.heroImage} className="absolute inset-0 w-full h-full object-cover" alt="Hero" />
              {siteSettings.showHeroOverlay && <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/70 to-indigo-900/40 backdrop-blur-[1px]"></div>}
              <div className="max-w-5xl mx-auto relative z-10 text-center px-6">
                <span className="inline-block px-4 py-1.5 bg-indigo-500/20 border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-8">Passie voor Kwaliteit</span>
                <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-none">Bouw mee aan <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">de toekomst.</span></h1>
                
                <div className="max-w-4xl mx-auto bg-white p-2 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row gap-2 mt-12">
                  <div className="flex-1 flex items-center px-6 py-4 bg-slate-50 rounded-2xl">
                    <Search className="w-5 h-5 text-indigo-600 mr-3" />
                    <input type="text" placeholder="Welke rol zoek je?" className="bg-transparent w-full outline-none font-bold text-slate-800" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="flex items-center px-6 py-4 bg-slate-50 rounded-2xl min-w-[220px]">
                    <Filter className="w-5 h-5 text-indigo-600 mr-3" />
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-transparent w-full outline-none font-black text-slate-700 uppercase text-[10px] tracking-widest cursor-pointer appearance-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* USP Section */}
            <section className="max-w-7xl mx-auto px-6 -mt-16 mb-24 relative z-20">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: <Award className="w-6 h-6" />, label: "Marktleider", sub: "35+ jaar expertise" },
                  { icon: <Heart className="w-6 h-6" />, label: "Familiebedrijf", sub: "Warme cultuur" },
                  { icon: <Rocket className="w-6 h-6" />, label: "Innovatie", sub: "Eigen mengerij" },
                  { icon: <Zap className="w-6 h-6" />, label: "Direct Impact", sub: "In Dronten" }
                ].map((usp, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-100 border border-slate-100 flex flex-col items-center text-center group hover:bg-indigo-600 transition-all duration-300">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white/20 group-hover:text-white transition-all">{usp.icon}</div>
                    <h4 className="font-black text-slate-800 group-hover:text-white transition-colors">{usp.label}</h4>
                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-100 uppercase tracking-widest mt-1">{usp.sub}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 py-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredVacancies.map(job => (
                  <div key={job.id} className="bg-white border border-slate-200 rounded-[3rem] p-8 hover:shadow-2xl transition-all cursor-pointer flex flex-col group" onClick={() => { setSelectedJob(job); setView('detail'); window.scrollTo(0,0); }}>
                    <div className="mb-6"><span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider rounded-lg">{job.department}</span></div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors leading-tight">{job.title}</h3>
                    <div className="flex items-center text-xs font-bold text-slate-400 mb-8 space-x-4">
                      <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1 text-indigo-400" />{job.location}</span>
                      <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-indigo-400" />{job.type}</span>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-8 flex-grow">{job.description}</p>
                    <button className="w-full py-4 bg-slate-900 group-hover:bg-indigo-600 text-white font-black rounded-2xl transition-all flex items-center justify-center space-x-3 text-xs uppercase tracking-widest">
                      <span>Ontdek Functie</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {view === 'detail' && selectedJob && (
          <div className="bg-white min-h-screen">
            <div className="relative h-[550px] flex items-center justify-center overflow-hidden">
              <img src={selectedJob.headerImage || siteSettings.heroImage} className="absolute inset-0 w-full h-full object-cover" alt="Header" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
              <div className="max-w-5xl mx-auto relative z-10 text-center px-6">
                <button onClick={() => setView('frontend')} className="mb-8 inline-flex items-center text-indigo-300 font-black uppercase text-[10px] tracking-[0.3em] hover:text-white transition-all bg-white/10 px-6 py-2 rounded-full backdrop-blur-md border border-white/20">
                  <ChevronLeft className="w-4 h-4 mr-2" />Terug naar Overzicht
                </button>
                <div className="mb-4"><span className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full">{selectedJob.department}</span></div>
                <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-8 tracking-tighter">{selectedJob.title}</h1>
                <div className="flex justify-center space-x-10 text-white font-bold text-sm uppercase tracking-widest opacity-90">
                  <span className="flex items-center"><MapPin className="w-5 h-5 mr-2 text-indigo-400" />{selectedJob.location}</span>
                  <span className="flex items-center"><Clock className="w-5 h-5 mr-2 text-indigo-400" />{selectedJob.type}</span>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-24">
              <div className="grid lg:grid-cols-12 gap-20">
                <div className="lg:col-span-8 space-y-24">
                  <section>
                    <h2 className="text-4xl font-black text-slate-900 mb-8 flex items-center"><Info className="w-10 h-10 mr-4 text-indigo-600" />De Uitdaging</h2>
                    <p className="text-xl font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
                  </section>
                  <div className="grid md:grid-cols-2 gap-16">
                    <section className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
                      <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center"><ListChecks className="w-7 h-7 mr-3 text-indigo-600" />Wat ga je doen?</h3>
                      <ul className="space-y-4">
                        {selectedJob.responsibilities.split('\n').map((item, i) => (
                          <li key={i} className="flex items-start text-slate-600 font-medium leading-relaxed">
                            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center mr-3 mt-0.5"><Check className="w-3.5 h-3.5" /></span>
                            {item.replace('• ', '')}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center"><Users className="w-7 h-7 mr-3 text-indigo-600" />Wie ben jij?</h3>
                      <ul className="space-y-4">
                        {selectedJob.requirements.split('\n').map((item, i) => (
                          <li key={i} className="flex items-start text-slate-600 font-medium leading-relaxed">
                            <span className="w-6 h-6 bg-slate-100 text-slate-400 rounded-full flex-shrink-0 flex items-center justify-center mr-3 mt-0.5"><Check className="w-3.5 h-3.5" /></span>
                            {item.replace('• ', '')}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                  <section className="bg-indigo-900 rounded-[3.5rem] p-12 md:p-16 text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-4">Over Frisson Dronten</h3>
                      <h2 className="text-4xl font-black mb-8">Passie voor Cosmetica sinds 1990</h2>
                      <p className="text-indigo-100 leading-relaxed font-medium">Frisson is al meer dan 35 jaar een gevestigde naam. Vanuit ons hypermoderne pand in Dronten ontwikkelen en produceren wij een breed scala aan producten. Wij investeren in jouw groei, vieren successen samen en bouwen elke dag aan een bedrijf waar we trots op zijn.</p>
                    </div>
                  </section>
                </div>
                <div className="lg:col-span-4">
                  <div className="sticky top-32 space-y-8">
                    <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-100">
                      <h4 className="text-2xl font-black mb-6 text-slate-900">Word jij onze nieuwe collega?</h4>
                      <button className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:scale-[1.03] transition-all text-xs uppercase tracking-[0.2em]">Solliciteer Nu</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'login' && (
          <div className="max-w-md mx-auto py-32 px-6">
            <div className="bg-white border border-slate-200 rounded-[3.5rem] p-12 shadow-2xl">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-6"><ShieldCheck className="w-8 h-8" /></div>
                <h2 className="text-3xl font-black text-slate-900">Admin Toegang</h2>
              </div>
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Gebruiker</label>
                  <select value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800" required>
                    <option value="">Kies gebruiker...</option>
                    {appUsers.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Wachtwoord</label>
                  <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" placeholder="••••••••" required />
                  {loginError && <p className="text-rose-500 text-xs mt-3 font-bold">{loginError}</p>}
                </div>
                <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px]">Inloggen</button>
              </form>
            </div>
          </div>
        )}

        {view === 'backend' && isAuthorized && (
          <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12">
            <div className="lg:w-64 space-y-2">
              <h2 className="text-2xl font-black mb-8 flex items-center"><LayoutDashboard className="w-6 h-6 mr-3 text-indigo-600" />Beheer</h2>
              {[
                { id: 'vacatures', label: 'Vacatures', icon: Briefcase },
                { id: 'gebruikers', label: 'Gebruikers', icon: Users },
                { id: 'rollen', label: 'Rollen', icon: ShieldCheck },
                { id: 'instellingen', label: 'Instellingen', icon: Settings }
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <t.icon className="w-5 h-5" /><span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-8">
              {activeTab === 'vacatures' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-black">Vacatures</h3>
                    <button onClick={() => { setEditingItem(null); setVacancyForm({ title: '', department: 'Productie', location: 'Dronten', type: 'Full-time', description: '', responsibilities: '', requirements: '', benefits: '', headerImage: '', status: STATUS.DRAFT }); setModalType('vacancy'); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center space-x-2 text-xs uppercase tracking-widest"><Plus className="w-4 h-4" /><span>Nieuwe Vacature</span></button>
                  </div>
                  <div className="bg-white border rounded-[2.5rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b"><tr><th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vacature</th><th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acties</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{vacancies.map(j => (
                        <tr key={j.id} className="hover:bg-slate-50/50 group">
                          <td className="px-8 py-6"><div className="font-bold text-slate-800 text-lg">{j.title}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{j.department} • {j.status}</div></td>
                          <td className="px-8 py-6 text-right space-x-2">
                            <button onClick={() => { setEditingItem(j); setVacancyForm({...j}); setModalType('vacancy'); }} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm"><FileText className="w-5 h-5" /></button>
                            <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vacancies', j.id))} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl shadow-sm"><Trash2 className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeTab === 'gebruikers' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-3xl font-black">Gebruikers</h3><button onClick={() => { setUserForm({username:'', password:'', roleId:''}); setModalType('user'); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center space-x-2 text-xs uppercase tracking-widest"><UserPlus className="w-4 h-4" /><span>Nieuwe Gebruiker</span></button></div>
                  <div className="bg-white border rounded-[2.5rem] overflow-hidden">
                    <table className="w-full text-left font-bold text-sm"><thead className="bg-slate-50 border-b"><tr><th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Naam</th><th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rol</th><th className="px-8 py-4 text-right"></th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{appUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50"><td className="px-8 py-5 text-slate-800">{u.username}</td><td className="px-8 py-5"><span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{u.roleId}</span></td><td className="px-8 py-5 text-right">{u.username !== 'admin' && <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'app_users', u.id))} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>}</td></tr>
                    ))}</tbody></table>
                  </div>
                </div>
              )}
              {activeTab === 'rollen' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><h3 className="text-3xl font-black">Rollen</h3><button onClick={() => { setRoleForm({name:'', permissions:[]}); setModalType('role'); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center space-x-2 text-xs uppercase tracking-widest"><ShieldAlert className="w-4 h-4" /><span>Nieuwe Rol</span></button></div>
                  <div className="grid md:grid-cols-2 gap-6">{roles.map(r => (
                    <div key={r.id} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative group">
                      <div className="flex justify-between mb-6"><h4 className="text-xl font-black text-indigo-600">{r.name}</h4>{r.id !== 'super_admin' && <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roles', r.id))} className="text-slate-300 hover:text-rose-600"><Trash2 className="w-5 h-5" /></button>}</div>
                      <div className="space-y-3">{Object.values(PERMISSIONS).map(p => (
                        <label key={p} className="flex items-center space-x-3 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:text-slate-800 transition-colors">
                          <input type="checkbox" checked={r.permissions?.includes(p)} disabled={r.id === 'super_admin'} onChange={async (e) => {
                            const newPerms = e.target.checked ? [...(r.permissions || []), p] : r.permissions.filter(x => x !== p);
                            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roles', r.id), { permissions: newPerms });
                          }} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                          <span>{p.replace('_', ' ')}</span>
                        </label>
                      ))}</div>
                    </div>
                  ))}</div>
                </div>
              )}
              {activeTab === 'instellingen' && (
                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm space-y-12">
                  <h3 className="text-2xl font-black">Layout & Branding</h3>
                  <div className="space-y-10">
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hero Image URL (Front-end)</label>
                      <div className="flex gap-4">
                        <input type="text" value={siteSettings.heroImage} onChange={(e) => setSiteSettings({...siteSettings, heroImage: e.target.value})} className="flex-1 px-6 py-4 bg-slate-50 border rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/10" />
                        <button onClick={() => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'site_config'), siteSettings)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2 uppercase text-[10px] tracking-widest"><Save className="w-4 h-4" /><span>Update</span></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <div><h4 className="font-black text-xl text-slate-800">Blauwe Overlay</h4><p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Verbetert contrast voor teksten</p></div>
                      <button onClick={() => { 
                        const s = {...siteSettings, showHeroOverlay: !siteSettings.showHeroOverlay}; 
                        setSiteSettings(s); 
                        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'site_config'), s); 
                      }} className={`w-16 h-9 rounded-full p-1.5 transition-all ${siteSettings.showHeroOverlay ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${siteSettings.showHeroOverlay ? 'translate-x-7' : 'translate-x-0'}`} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white w-full max-w-4xl my-8 rounded-[4rem] shadow-2xl relative animate-in zoom-in duration-300 p-16">
            <button onClick={() => setModalType(null)} className="absolute top-10 right-10 text-slate-300 hover:text-rose-500 transition-colors"><XCircle className="w-10 h-10" /></button>
            <h3 className="text-4xl font-black tracking-tight mb-10 text-slate-900 uppercase text-center">{modalType}</h3>
            {modalType === 'vacancy' && (
              <form onSubmit={handleSaveVacancy} className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="col-span-full"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Titel</label><input required type="text" value={vacancyForm.title} onChange={(e) => setVacancyForm({...vacancyForm, title: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" /></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Afdeling</label><select value={vacancyForm.department} onChange={(e) => setVacancyForm({...vacancyForm, department: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">{CATEGORIES.filter(c => c !== 'Alle Afdelingen').map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Status</label><select value={vacancyForm.status} onChange={(e) => setVacancyForm({...vacancyForm, status: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-indigo-600 uppercase tracking-widest"><option value={STATUS.DRAFT}>Concept</option><option value={STATUS.ACTIVE}>Actief</option></select></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Uren</label><input type="text" value={vacancyForm.type} onChange={(e) => setVacancyForm({...vacancyForm, type: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="bijv. 32-40 uur" /></div>
                  <div className="col-span-full"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Header Image URL</label><input type="text" value={vacancyForm.headerImage} onChange={(e) => setVacancyForm({...vacancyForm, headerImage: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" /></div>
                </div>
                <div className="space-y-8">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Omschrijving (Intro)</label><textarea rows="4" value={vacancyForm.description} onChange={(e) => setVacancyForm({...vacancyForm, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium leading-relaxed resize-none" /></div>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Taken</label><textarea rows="6" value={vacancyForm.responsibilities} onChange={(e) => setVacancyForm({...vacancyForm, responsibilities: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm leading-relaxed" /></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Eisen</label><textarea rows="6" value={vacancyForm.requirements} onChange={(e) => setVacancyForm({...vacancyForm, requirements: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm leading-relaxed" /></div>
                  </div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Voordelen</label><textarea rows="4" value={vacancyForm.benefits} onChange={(e) => setVacancyForm({...vacancyForm, benefits: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm leading-relaxed" /></div>
                </div>
                <button type="submit" className="w-full py-6 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-200 uppercase tracking-[0.2em] text-xs">Publiceren</button>
              </form>
            )}
            {modalType === 'user' && (
              <form onSubmit={handleSaveUser} className="space-y-10">
                <input required type="text" value={userForm.username} onChange={(e) => setUserForm({...userForm, username: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-bold" placeholder="Gebruikersnaam" />
                <input required type="password" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-bold" placeholder="Wachtwoord" />
                <select value={userForm.roleId} onChange={(e) => setUserForm({...userForm, roleId: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-bold"><option value="">Selecteer rol...</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                <button type="submit" className="w-full py-6 bg-slate-900 text-white font-black rounded-3xl uppercase tracking-[0.2em] text-xs">Account Aanmaken</button>
              </form>
            )}
            {modalType === 'role' && (
              <form onSubmit={handleSaveRole} className="space-y-12">
                <input required type="text" value={roleForm.name} onChange={(e) => setRoleForm({...roleForm, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black text-indigo-600" placeholder="Rol Naam" />
                <div className="grid grid-cols-2 gap-4">
                  {Object.values(PERMISSIONS).map(p => (
                    <label key={p} className="flex items-center space-x-4 p-6 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100">
                      <input type="checkbox" checked={roleForm.permissions.includes(p)} onChange={(e) => {
                        const newP = e.target.checked ? [...roleForm.permissions, p] : roleForm.permissions.filter(x => x !== p);
                        setRoleForm({...roleForm, permissions: newP});
                      }} className="w-6 h-6 rounded border-slate-300 text-indigo-600" />
                      <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{p.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                <button type="submit" className="w-full py-6 bg-indigo-600 text-white font-black rounded-3xl uppercase tracking-[0.2em] text-xs">Rol Opslaan</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 py-24 px-6 text-center border-t border-slate-800 mt-20">
        <div className="max-w-7xl mx-auto space-y-10 opacity-60">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black">F</div>
            <span className="text-white font-black tracking-tight text-xl uppercase">Frisson Dronten</span>
          </div>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.3em] pt-10 border-t border-white/5">© 2026 Frisson Productie BV • Werken bij de Marktleider</p>
        </div>
      </footer>
    </div>
  );
}
