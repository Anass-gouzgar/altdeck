/* ==========================================================================
   AltDeck Showcase Landing Page Interactive Script
   Includes Web Audio Synthesizer, Trilingual i18n (EN, FR, AR RTL),
   and Interactive Operating Mode Simulators
   ========================================================================== */

// --- 1. Comprehensive Trilingual Translation Dictionary ---
const TRANSLATIONS = {
  en: {
    navFeatures: "Features",
    navPlayground: "Interactive Deck",
    navArchitecture: "Architecture",
    navComparison: "Comparison",
    navQuickStart: "Quick Start",
    starGithub: "GitHub",
    heroPill: "Open Source • Windows 10 & 11 Hardware Controller",
    heroTitle: "An open-source Stream Deck that runs on any old tablet.",
    heroSubtitle: "Control master volume, hardware monitor brightness, launch desktop apps, glide a precision trackpad, type on a 4x4 numpad, and beam files over local Wi-Fi with sub-10ms response. Zero mobile app to install.",
    heroCtaPrimary: "Run Locally (60s)",
    heroCtaSecondary: "Try Interactive Demo",
    heroCtaGithub: "View Source Code",
    specLatency: "Local Latency",
    specFree: "100% Free & Open Source",
    specPwa: "Runs in Mobile Browser",
    specNative: "Direct Windows Kernel",
    pcOnlineBadge: "PC ONLINE",

    badgePlayground: "Interactive Sandbox",
    playgroundTitle: "5 Operating Modes in 1 Deck",
    playgroundDesc: "Click any mode below to test the tactile controls, responsiveness, and instant click audio feedback right here on your browser.",
    tabDeck: "1. Stream Deck",
    tabTrackpad: "2. Trackpad Pro",
    tabNumpad: "3. 4x4 Numpad",
    tabBeam: "4. AirDrop Beam",
    tabPower: "5. Power & Rescue",

    demoVolTitle: "Master Volume & Audio",
    btnMute: "Mute",
    micOnAir: "🔴 LIVE ON AIR",
    micMuted: "🔇 MIC MUTED",
    micDesc: "CoreAudio Endpoint Capture",
    btnMuteMic: "MUTE MIC",
    btnUnmuteMic: "UNMUTE MIC",

    demoDisplayTitle: "Display & Quick Toggles",
    badgeWmi: "WMI Direct",
    toggleScreenOff: "Screen Off",
    toggleScreenOffSub: "Without Sleep",
    toggleProject: "Project (Win+P)",
    toggleProjectSub: "Multi-Display",
    toggleNightLight: "Night Light",
    toggleNightLightSub: "Warmth Filter",
    toggleCalc: "Calculator",
    toggleCalcSub: "Instant Launch",

    demoAppsTitle: "Application Launchpad",
    badgeOneTap: "One-Tap Launch",

    demoTrackpadSurfaceTitle: "Multi-Touch Touchpad",
    badgeInteractive: "Interactive",
    trackpadGlidePrompt: "Glide finger or mouse here",
    trackpadGestures: "2-Finger Scroll • Tap to Left Click",
    tpLeft: "LEFT CLICK",
    tpMiddle: "MIDDLE",
    tpRight: "RIGHT CLICK",
    demoTrackpadProTitle: "Hardware Pro Companion",
    badgePresets: "4 Presets",
    labelPointerSpeed: "Pointer Sensitivity Presets",
    labelTriggers: "Actions",
    actionDoubleClick: "Double Click",
    actionDoubleClickSub: "Instant Trigger",
    actionDragLock: "Drag Lock",
    actionDragLockSub: "Hold & Move",

    demoNumpadTitle: "4x4 Accounting Numpad",
    demoTypingTitle: "Remote PC Typing & Navigation",
    badgeInstant: "Instant",
    labelTyping: "Remote Text Injection",
    btnSendText: "Send",
    labelNavKeys: "Navigation Keys",

    demoBeamTitle: "AltDeck Beam — AirDrop for PC",
    badgeWifi: "Wi-Fi Direct",
    beamPrompt: "Tap to Simulate File Drop or Camera Photo",
    beamSub: "Streams straight into Desktop / AltDeck Transfers",
    demoRecentTransfers: "Recent Transfers",
    btnOpenFolder: "Open PC Folder",

    demoPowerTitle: "Power Management & Safety",
    badgeCountdown: "30s Countdown",
    pLock: "Lock PC",
    pScreenOff: "Screen Off",
    pSleep: "Sleep",
    pRestart: "Restart",
    pShutdown: "Shutdown",
    pAbort: "Abort /a",
    demoRescueTitle: "Emergency Windows Rescue",
    badgeNoReboot: "No Reboot",
    rescueExplorerTitle: "Restart Windows Explorer",
    rescueExplorerDesc: "Restores frozen taskbars or start menus.",
    rescueAudioTitle: "Restart Audio Service (Audiosrv)",
    rescueAudioDesc: "Recovers frozen sound without restarting PC.",
    btnRunFix: "Run Fix",

    badgeEngineered: "Engineered for Performance",
    bentoSectionTitle: "Why AltDeck is Built Different",
    bentoSectionDesc: "A lean, native Windows architecture designed to avoid proprietary hardware lock-in.",
    bento1Title: "Sub-10ms Native C# Engine",
    bento1Desc: "Direct integration into low-level Windows APIs via a high-performance compiled companion (pc-control.exe). Taps directly into IAudioEndpointVolume CoreAudio COM interfaces, WMI physical monitor brightness, and SendInput hardware scancodes.",
    bento2Title: "Zero-Void Layout",
    bento2Desc: "Mathematically balanced multi-column grid with 0 empty slots across iPad Pro, Android tablets, smartphones, split-screens, and 4K ultrawide displays.",
    bento3Title: "Task Manager Deck",
    bento3Desc: "Real-time 60-second SVG load waveforms for CPU & RAM. Active scanner displaying the top 5 memory-heavy background apps with one-tap instant Kill buttons.",
    bento4Title: "16-App Launchpad",
    bento4Desc: "Official high-resolution branding for VS Code, Discord, Claude AI, Chrome, Edge, Antigravity, Office 365, plus auto-scanner detecting installed PC software.",
    bento5Title: "Trilingual & RTL First",
    bento5Desc: "Full dynamic localization in English, French, and Arabic with native RTL layout and Cairo typography. Plus 14 luxury dark themes for any setup.",
    bento6Title: "Universal 24/7 Keep-Awake Engine",
    bento6Desc: "Browser-based wake lock APIs normally require HTTPS, which breaks on local Wi-Fi IP addresses. AltDeck solves this with a dual-pipeline engine combining the Native Screen WakeLock API with an invisible seamless video buffer fallback (NoSleep.js), keeping your tablet awake indefinitely.",

    badgeArchitecture: "Architecture",
    archTitle: "How Data Flows at <10ms",
    archDesc: "An ultra-lean pipeline designed with zero bloat and zero cloud dependency.",
    archNode1: "Tablet / iPad",
    archNode1Desc: "PWA Client • WebSocket • Gyro Touchpad",
    archNode2: "Node.js Server",
    archNode2Desc: "Local HTTP & WS Dispatcher • Telemetry",
    archNode3: "Native C# Core",
    archNode3Desc: "pc-control.exe • CoreAudio COM • WMI",
    archNode4: "Windows 10 / 11",
    archNode4Desc: "Master Volume • Monitor Brightness • Window Snap",

    badgeComparison: "Comparison",
    compTitle: "Why AltDeck Dominates Alternatives",
    compDesc: "See how AltDeck stacks up against $150 proprietary hardware and paid tablet apps.",
    thFeature: "Feature Matrix",
    thAltDeck: "AltDeck (Open Source)",
    rowPrice: "Price",
    valFree: "$0 (Free Forever)",
    rowInstall: "Tablet App Required?",
    valNoInstall: "No (Zero-Install PWA)",
    valHardwareOnly: "Hardware Only",
    valYesStore: "Yes (App Store / Play)",
    valYesApk: "Yes (Play Store APK)",
    rowAudio: "Hardware Master Audio Endpoint",
    valNativeCom: "✅ True CoreAudio COM",
    valPlugin: "⚠️ Plugin Required",
    valVirtualCable: "⚠️ Virtual Cable",
    valBasicMedia: "❌ Basic Media Key",
    rowBrightness: "Monitor Hardware Brightness",
    valWmiNative: "✅ Yes (0-100% WMI)",
    valNo: "❌ None",
    rowTrackpad: "Wireless Touchpad & Numpad",
    valIncluded: "✅ Included",
    valDiy: "⚠️ DIY Layout",
    rowBeam: "Wi-Fi AirDrop File Drop",

    badgeQuickStart: "Quick Start",
    qsTitle: "Up and Running in 60 Seconds",
    qsDesc: "No external compilers, no manual dependencies, no cloud registration required.",
    tabGitClone: "Git Clone (Recommended)",
    tabBatch: "Windows 1-Click Batch",
    btnCopy: "Copy Code",
    step1Title: "Run on PC",
    step1Desc: "Double click start-controller.bat or run npm start. AltDeck auto-compiles the C# binary on first launch.",
    step2Title: "Open on Tablet",
    step2Desc: "Open Chrome or Safari on your tablet and type the local IP address shown in terminal.",
    step3Title: "Add to Home Screen",
    step3Desc: "Tap Install or Add to Home Screen for a borderless, full-screen deck experience.",

    creatorTag: "Crafted by",
    creatorBio: "Full Stack Engineer & Systems Developer passionate about high-performance real-time software, low-level Windows APIs, and zero-latency human-computer interfaces.",
    btnViewAltdeck: "View AltDeck Repo",
    footerCopy: "Released under the MIT License. Open-source software built for creators, streamers, and developers.",
    footerTop: "Back to Top ↑",
    footerSource: "Source Code",

    modalConfirmTitle: "Restart System",
    modalConfirmDesc: "Safe countdown initiated. In a live AltDeck deployment, your PC will safely reboot in:",
    btnDismiss: "Dismiss Demo",
    btnAbort: "Cancel (shutdown /a)",

    toastScreenOff: "🖥️ Screen Off Activated (PC kept awake)",
    toastProject: "📺 Win + P Project Flyout Opened",
    toastNightLight: "🌙 Night Light Toggled",
    toastCalc: "🧮 Calculator Launched on PC",
    toastLaunch: "🚀 Launched: ",
    toastLeftClick: "🖱️ Precision Touchpad: Left Click",
    toastMiddleClick: "🖱️ Precision Touchpad: Middle Click",
    toastRightClick: "🖱️ Precision Touchpad: Right Click",
    toastDoubleClick: "⚡ Double Click Executed",
    toastDragLock: "🔒 Drag Lock Toggled",
    toastOpenFolder: "📂 Opened Desktop / AltDeck Transfers folder on PC",
    toastLock: "🔒 Windows Workstation Locked (Win + L)",
    toastSleep: "💤 Low-Power System Sleep Engaged",
    toastAbort: "🛑 Shutdown Cancelled (shutdown /a executed)",
    toastRestartExplorer: "🔄 Explorer.exe safely restarted without reboot!",
    toastRestartAudio: "🎧 Windows Audiosrv service restarted!"
  },

  fr: {
    navFeatures: "Fonctionnalités",
    navPlayground: "Démo Interactive",
    navArchitecture: "Architecture",
    navComparison: "Comparatif",
    navQuickStart: "Démarrage Rapide",
    starGithub: "GitHub",
    heroPill: "Open Source • Contrôleur Matériel Windows 10 & 11",
    heroTitle: "Un Stream Deck open-source qui tourne sur n'importe quelle tablette.",
    heroSubtitle: "Contrôlez le volume principal, la luminosité WMI, lancez vos applications, profitez d'un pavé tactile précis, d'un pavé numérique 4x4 et transférez des fichiers par Wi-Fi en moins de 10ms. Aucune application mobile requise.",
    heroCtaPrimary: "Lancer en Local (60s)",
    heroCtaSecondary: "Tester la Démo",
    heroCtaGithub: "Voir le Code Source",
    specLatency: "Latence Locale",
    specFree: "100% Gratuit & Libre",
    specPwa: "Dans le Navigateur Mobile",
    specNative: "Noyau Windows Direct",
    pcOnlineBadge: "PC EN LIGNE",

    badgePlayground: "Bac à Sable Interactif",
    playgroundTitle: "5 Modes de Fonctionnement en 1",
    playgroundDesc: "Cliquez sur un mode ci-dessous pour tester l'ergonomie, la réactivité et les clics audio en direct.",
    tabDeck: "1. Stream Deck",
    tabTrackpad: "2. Pavé Tactile Pro",
    tabNumpad: "3. Pavé Numérique 4x4",
    tabBeam: "4. AirDrop Wi-Fi",
    tabPower: "5. Alimentation & Secours",

    demoVolTitle: "Volume Principal & Audio",
    btnMute: "Muet",
    micOnAir: "🔴 EN DIRECT",
    micMuted: "🔇 MICRO COUPÉ",
    micDesc: "Capture Endpoint CoreAudio",
    btnMuteMic: "COUPER MICRO",
    btnUnmuteMic: "RÉACTIVER MICRO",

    demoDisplayTitle: "Affichage & Raccourcis",
    badgeWmi: "Direct WMI",
    toggleScreenOff: "Écrans Éteints",
    toggleScreenOffSub: "Sans mise en veille",
    toggleProject: "Projeter (Win+P)",
    toggleProjectSub: "Multi-Écrans",
    toggleNightLight: "Éclairage Nocturne",
    toggleNightLightSub: "Filtre Chaud",
    toggleCalc: "Calculatrice",
    toggleCalcSub: "Lancement Rapide",

    demoAppsTitle: "Lanceur d'Applications",
    badgeOneTap: "Un Seul Clic",

    demoTrackpadSurfaceTitle: "Pavé Tactile Multi-Touch",
    badgeInteractive: "Interactif",
    trackpadGlidePrompt: "Glissez le doigt ou la souris ici",
    trackpadGestures: "Défilement 2 Doigts • Tapez pour Clic Gauche",
    tpLeft: "CLIC GAUCHE",
    tpMiddle: "MILIEU",
    tpRight: "CLIC DROIT",
    demoTrackpadProTitle: "Compagnon Pro",
    badgePresets: "4 Vitesses",
    labelPointerSpeed: "Sensibilité du Curseur",
    labelTriggers: "Actions Rapides",
    actionDoubleClick: "Double Clic",
    actionDoubleClickSub: "Ouverture Rapide",
    actionDragLock: "Verrou Glisser",
    actionDragLockSub: "Maintenir & Déplacer",

    demoNumpadTitle: "Pavé Numérique 4x4",
    demoTypingTitle: "Frappe & Navigation à Distance",
    badgeInstant: "Instantané",
    labelTyping: "Injection de Texte PC",
    btnSendText: "Envoyer",
    labelNavKeys: "Touches de Navigation",

    demoBeamTitle: "AltDeck Beam — AirDrop pour PC",
    badgeWifi: "Wi-Fi Direct",
    beamPrompt: "Tapez pour Déposer un Fichier ou Photo Caméra",
    beamSub: "Transféré directement dans Bureau / AltDeck Transfers",
    demoRecentTransfers: "Transferts Récents",
    btnOpenFolder: "Ouvrir Dossier PC",

    demoPowerTitle: "Gestion d'Alimentation Sécurisée",
    badgeCountdown: "Compte à Rebours 30s",
    pLock: "Verrouiller",
    pScreenOff: "Écrans Off",
    pSleep: "Veille",
    pRestart: "Redémarrer",
    pShutdown: "Arrêter",
    pAbort: "Annuler /a",
    demoRescueTitle: "Dépannage d'Urgence Windows",
    badgeNoReboot: "Sans Redémarrer",
    rescueExplorerTitle: "Redémarrer l'Explorateur Windows",
    rescueExplorerDesc: "Restaure la barre des tâches ou le menu démarrer figé.",
    rescueAudioTitle: "Redémarrer le Service Audio (Audiosrv)",
    rescueAudioDesc: "Restaure le son bloqué sans redémarrer le PC.",
    btnRunFix: "Exécuter",

    badgeEngineered: "Conçu pour la Performance",
    bentoSectionTitle: "Pourquoi AltDeck est Différent",
    bentoSectionDesc: "Une architecture Windows native ultra-légère sans matériel propriétaire coûteux.",
    bento1Title: "Moteur C# Natif sous les 10ms",
    bento1Desc: "Intégration directe aux API Windows via un compagnon C# compilé rapide (pc-control.exe). Contrôle CoreAudio COM IAudioEndpointVolume, luminosité WMI et SendInput.",
    bento2Title: "Disposition Zéro Espace Mort",
    bento2Desc: "Grille calculée sans aucune case vide sur iPad, tablettes Android, smartphones et écrans PC 4K.",
    bento3Title: "Gestionnaire des Tâches",
    bento3Desc: "Graphique SVG en direct sur 60 secondes pour CPU et RAM. Scanner des 5 processus les plus gourmands avec bouton [Kill] instantané.",
    bento4Title: "Lanceur 16 Applications",
    bento4Desc: "Icônes officielles pour VS Code, Discord, Claude AI, Chrome, Edge, Antigravity, Office 365, plus détection automatique des apps PC.",
    bento5Title: "Trilingue & Support RTL",
    bento5Desc: "Traduction dynamique en Anglais, Français et Arabe avec alignement RTL et police Cairo. 14 thèmes sombres inclus.",
    bento6Title: "Maintien d'Éveil 24/7 Universel",
    bento6Desc: "L'API WakeLock classique exige HTTPS, bloqué sur IP locale. AltDeck combine l'API native et un tampon vidéo discret (NoSleep.js) pour garder votre tablette allumée.",

    badgeArchitecture: "Architecture",
    archTitle: "Comment les Données Circulent (<10ms)",
    archDesc: "Un pipeline ultra-rapide sans dépendance cloud.",
    archNode1: "Tablette / iPad",
    archNode1Desc: "Client PWA • WebSocket • Pavé Tactile",
    archNode2: "Serveur Node.js",
    archNode2Desc: "Dispatcher HTTP & WS Local • Télémétrie",
    archNode3: "Cœur Natif C#",
    archNode3Desc: "pc-control.exe • CoreAudio COM • WMI",
    archNode4: "Windows 10 / 11",
    archNode4Desc: "Volume Principal • Luminosité • Ancrage",

    badgeComparison: "Comparatif",
    compTitle: "Pourquoi Choisir AltDeck",
    compDesc: "Comparé aux boîtiers propriétaires à 150$ et aux applications payantes.",
    thFeature: "Critères",
    thAltDeck: "AltDeck (Open Source)",
    rowPrice: "Prix",
    valFree: "0$ (Gratuit pour Toujours)",
    rowInstall: "Application Mobile Requise ?",
    valNoInstall: "Non (PWA Zéro Installation)",
    valHardwareOnly: "Matériel Dédié",
    valYesStore: "Oui (App Store / Play)",
    valYesApk: "Oui (Fichier APK)",
    rowAudio: "Volume Principal Réel",
    valNativeCom: "✅ Véritable CoreAudio COM",
    valPlugin: "⚠️ Plugin Requis",
    valVirtualCable: "⚠️ Câble Virtuel",
    valBasicMedia: "❌ Touche Média Basique",
    rowBrightness: "Luminosité Physique Écran",
    valWmiNative: "✅ Oui (0-100% WMI)",
    valNo: "❌ Aucun",
    rowTrackpad: "Pavé Tactile & Numérique",
    valIncluded: "✅ Inclus",
    valDiy: "⚠️ À configurer soi-même",
    rowBeam: "Transfert Fichiers AirDrop Wi-Fi",

    badgeQuickStart: "Démarrage Rapide",
    qsTitle: "Prêt en 60 Secondes",
    qsDesc: "Aucun compilateur externe, aucune dépendance manuelle, aucun compte requis.",
    tabGitClone: "Cloner avec Git (Recommandé)",
    tabBatch: "Fichier Batch Windows en 1 Clic",
    btnCopy: "Copier le Code",
    step1Title: "Lancer sur PC",
    step1Desc: "Double-cliquez sur start-controller.bat ou lancez npm start. AltDeck compile le binaire C# au premier lancement.",
    step2Title: "Ouvrir sur Tablette",
    step2Desc: "Ouvrez Chrome ou Safari sur votre tablette et entrez l'adresse IP locale affichée dans le terminal.",
    step3Title: "Ajouter à l'Écran d'Accueil",
    step3Desc: "Installez en PWA plein écran pour une immersion totale sans bordures.",

    creatorTag: "Développé par",
    creatorBio: "Ingénieur Full Stack & Systèmes passionné par les logiciels temps réel haute performance et les API bas-niveau Windows.",
    btnViewAltdeck: "Voir le Dépôt AltDeck",
    footerCopy: "Publié sous Licence MIT. Logiciel libre conçu pour les créateurs, streamers et développeurs.",
    footerTop: "Haut de Page ↑",
    footerSource: "Code Source",

    modalConfirmTitle: "Confirmer le Redémarrage",
    modalConfirmDesc: "Compte à rebours sécurisé déclenché. Sur votre PC, l'action s'exécutera dans :",
    btnDismiss: "Fermer la Démo",
    btnAbort: "Annuler (shutdown /a)",

    toastScreenOff: "🖥️ Écrans éteints (PC maintenu éveillé)",
    toastProject: "📺 Menu Projeter (Win+P) ouvert",
    toastNightLight: "🌙 Éclairage nocturne basculé",
    toastCalc: "🧮 Calculatrice lancée sur PC",
    toastLaunch: "🚀 Lancé : ",
    toastLeftClick: "🖱️ Pavé tactile : Clic gauche",
    toastMiddleClick: "🖱️ Pavé tactile : Clic milieu",
    toastRightClick: "🖱️ Pavé tactile : Clic droit",
    toastDoubleClick: "⚡ Double clic exécuté",
    toastDragLock: "🔒 Verrouillage glisser basculé",
    toastOpenFolder: "📂 Dossier Bureau / AltDeck Transfers ouvert sur PC",
    toastLock: "🔒 Session Windows verrouillée (Win + L)",
    toastSleep: "💤 Mise en veille système engagée",
    toastAbort: "🛑 Arrêt annulé (commande shutdown /a envoyée)",
    toastRestartExplorer: "🔄 Explorer.exe redémarré avec succès !",
    toastRestartAudio: "🎧 Service audio Audiosrv redémarré !"
  },

  ar: {
    navFeatures: "المميزات",
    navPlayground: "تجربة حية",
    navArchitecture: "البنية البرمجية",
    navComparison: "المقارنة",
    navQuickStart: "البدء السريع",
    starGithub: "جيت هاب",
    heroPill: "مفتوح المصدر • تحكم مباشر بعتاد ويندوز 10 و 11",
    heroTitle: "بديل ستريم دك مفتوح المصدر يعمل على أي تابلت أو هاتف قديم.",
    heroSubtitle: "تحكم بمستوى الصوت الرئيسي، سطوع الشاشات عبر WMI، تشغيل البرامج، لوحة لمس دقيقة، لوحة أرقام 4x4 ونقل الملفات عبر الواي فاي بزمن استجابة أقل من 10ms دون الحاجة لتثبيت أي تطبيق.",
    heroCtaPrimary: "تشغيل محلي (60 ثانية)",
    heroCtaSecondary: "تجربة تفاعلية",
    heroCtaGithub: "الكود المصدري",
    specLatency: "استجابة محلية",
    specFree: "مجاني ومفتوح 100%",
    specPwa: "يعمل داخل المتصفح",
    specNative: "تحكم مباشر بنواة ويندوز",
    pcOnlineBadge: "الكمبيوتر متصل",

    badgePlayground: "بيئة تجربة تفاعلية",
    playgroundTitle: "5 أوضاع تشغيل متكاملة في شاشة واحدة",
    playgroundDesc: "اضغط على أي وضع بالأسفل لتجربة الأزرار اللمسية، سرعة الاستجابة والصوت التفاعلي مباشرة هنا.",
    tabDeck: "1. ستريم دك الرئيسي",
    tabTrackpad: "2. لوحة لمس احترافية",
    tabNumpad: "3. لوحة أرقام 4x4",
    tabBeam: "4. إسقاط الملفات (AirDrop)",
    tabPower: "5. الطاقة والطوارئ",

    demoVolTitle: "مستوى الصوت والوسائط",
    btnMute: "كتم",
    micOnAir: "🔴 المايكروفون يعمل",
    micMuted: "🔇 المايكروفون مكتوم",
    micDesc: "التقاط مباشر عبر CoreAudio",
    btnMuteMic: "كتم المايك",
    btnUnmuteMic: "تشغيل المايك",

    demoDisplayTitle: "الشاشة والاختصارات",
    badgeWmi: "تحكم مباشر WMI",
    toggleScreenOff: "إطفاء الشاشات",
    toggleScreenOffSub: "مع بقاء الجهاز يعمل",
    toggleProject: "شاشة العرض (Win+P)",
    toggleProjectSub: "شاشات متعددة",
    toggleNightLight: "الوضع الليلي",
    toggleNightLightSub: "فلتر الإضاءة الدافئة",
    toggleCalc: "الآلة الحاسبة",
    toggleCalcSub: "تشغيل فوري",

    demoAppsTitle: "منصة تشغيل التطبيقات",
    badgeOneTap: "ضغطة واحدة",

    demoTrackpadSurfaceTitle: "لوحة لمس متعددة النقاط",
    badgeInteractive: "تفاعلي",
    trackpadGlidePrompt: "حرّك إصبعك أو الفأرة هنا",
    trackpadGestures: "تمرير بإصبعين • نقرة للنقر الأيسر",
    tpLeft: "نقرة يسار",
    tpMiddle: "نقرة وسط",
    tpRight: "نقرة يمين",
    demoTrackpadProTitle: "لوحة التحكم المساعدة",
    badgePresets: "4 سرعات",
    labelPointerSpeed: "سرعة استجابة المؤشر",
    labelTriggers: "إجراءات سريعة",
    actionDoubleClick: "نقرة مزدوجة",
    actionDoubleClickSub: "فتح فوري",
    actionDragLock: "تثبيت السحب",
    actionDragLockSub: "إمساك وتحريك",

    demoNumpadTitle: "لوحة أرقام محاسبية 4x4",
    demoTypingTitle: "الكتابة والتنقل عن بُعد",
    badgeInstant: "فوري",
    labelTyping: "إدخال نص مباشرة في الكمبيوتر",
    btnSendText: "إرسال",
    labelNavKeys: "أزرار التنقل",

    demoBeamTitle: "AltDeck Beam — نقل الملفات السريع",
    badgeWifi: "واي فاي مباشر",
    beamPrompt: "اضغط لإسقاط ملف أو التقاط صورة بالكاميرا",
    beamSub: "تُحفظ مباشرة في مجلد AltDeck Transfers على سطح المكتب",
    demoRecentTransfers: "الملفات المستلمة مؤخراً",
    btnOpenFolder: "فتح المجلد على الكمبيوتر",

    demoPowerTitle: "إدارة الطاقة والعد التنازلي الآمن",
    badgeCountdown: "عد تنازلي 30 ثانية",
    pLock: "قفل الشاشة",
    pScreenOff: "إطفاء الشاشات",
    pSleep: "وضع السكون",
    pRestart: "إعادة التشغيل",
    pShutdown: "إيقاف التشغيل",
    pAbort: "إلغاء /a",
    demoRescueTitle: "أدوات الطوارئ وإنقاذ ويندوز",
    badgeNoReboot: "بدون إعادة تشغيل",
    rescueExplorerTitle: "إعادة تشغيل مستكشف ويندوز (Explorer)",
    rescueExplorerDesc: "يصلح شريط المهام وقائمة ابدأ إذا توقفت.",
    rescueAudioTitle: "إعادة تشغيل خدمة الصوت (Audiosrv)",
    rescueAudioDesc: "يستعيد الصوت المفقود أو المعلق بدون إعادة تشغيل الكمبيوتر.",
    btnRunFix: "تشغيل الإصلاح",

    badgeEngineered: "هندسة أداء عالية",
    bentoSectionTitle: "لماذا تم بناء AltDeck بشكل مختلف",
    bentoSectionDesc: "بنية نظام خفيفة ومباشرة لنظام ويندوز تتفوق على الأجهزة باهظة الثمن.",
    bento1Title: "محرك C# الأصلي باستجابة أقل من 10ms",
    bento1Desc: "تكامل مباشر مع واجهات ويندوز البرمجية المنخفضة عبر برنامج مساعد فائق السرعة (pc-control.exe) يتصل بـ CoreAudio COM ومستويات سطوع WMI وأوامر SendInput للأزرار.",
    bento2Title: "تصميم متناسق بدون مساحات فارغة",
    bento2Desc: "شبكة متوازنة رياضياً تملأ كامل الشاشة على الآيباد، أجهزة أندرويد اللوحية، الهواتف، والشاشات العريضة 4K.",
    bento3Title: "لوحة إدارة المهام والعمليات",
    bento3Desc: "رسم بياني حي لآخر 60 ثانية لحمل المعالج والذاكرة. وماسح مباشر لأكثر 5 برامج استهلاكاً للرام مع زر [إنهاء فوري].",
    bento4Title: "منصة تشغيل 16 تطبيقاً",
    bento4Desc: "شعارات رسمية عالية الدقة لتطبيقات VS Code و Discord و Claude و Chrome و Office 365، مع فحص تلقائي لجميع برامج الجهاز.",
    bento5Title: "دعم كامل للغة العربية (RTL)",
    bento5Desc: "ترجمة كاملة مع اتجاه من اليمين لليسار وخط Cairo العربي. بالإضافة لـ 14 مظهراً داكناً يناسب أي مكتب.",
    bento6Title: "محرك الإبقاء على الشاشة نشطة 24/7",
    bento6Desc: "تتطلب واجهات المتصفحات العادية اتصال HTTPS الآمن، والذي لا يتوفر على شبكات الواي فاي المحلية. يحل AltDeck ذلك عبر محرك مزدوج يدمج WakeLock مع فيديو خفي يمنع إطفاء الشاشة تماماً.",

    badgeArchitecture: "البنية الهندسية",
    archTitle: "كيف تنتقل البيانات بزمن أقل من 10ms",
    archDesc: "مسار بيانات محلي فائق السرعة بدون أي اعتماد على السحابة.",
    archNode1: "التابلت / الآيباد",
    archNode1Desc: "تطبيق ويب PWA • اتصال WebSocket • لوحة لمس",
    archNode2: "خادم Node.js",
    archNode2Desc: "موزع محلي • بيانات استهلاك العتاد",
    archNode3: "نواة C# الأصلية",
    archNode3Desc: "pc-control.exe • اتصال COM • واجهة WMI",
    archNode4: "ويندوز 10 / 11",
    archNode4Desc: "مستوى الصوت • السطوع • إدارة النوافذ",

    badgeComparison: "المقارنة مع البدائل",
    compTitle: "لماذا يتفوق AltDeck على البدائل",
    compDesc: "مقارنة مباشرة مع أجهزة ستريم دك بسعر 150$ وتطبيقات الهواتف المدفوعة.",
    thFeature: "الميزة",
    thAltDeck: "AltDeck (مفتوح المصدر)",
    rowPrice: "السعر",
    valFree: "0$ (مجاني للأبد)",
    rowInstall: "هل يتطلب تطبيق هاتف؟",
    valNoInstall: "لا (PWA داخل المتصفح فوراً)",
    valHardwareOnly: "جهاز مادي فقط",
    valYesStore: "نعم (من المتجر مدفوع)",
    valYesApk: "نعم (ملف APK)",
    rowAudio: "تحكم حقيقي بمخرج الصوت الأساسي",
    valNativeCom: "✅ تحكم أصلي CoreAudio COM",
    valPlugin: "⚠️ يتطلب إضافات",
    valVirtualCable: "⚠️ يتطلب كيبل صوت وهمي",
    valBasicMedia: "❌ أزرار وسائط عادية",
    rowBrightness: "سطوع الشاشات الفيزيائية",
    valWmiNative: "✅ نعم (0-100% WMI)",
    valNo: "❌ غير مدعوم",
    rowTrackpad: "لوحة لمس ولوحة أرقام",
    valIncluded: "✅ مدمجة بالكامل",
    valDiy: "⚠️ بناء يدوي معقد",
    rowBeam: "إسقاط الملفات عبر الواي فاي",

    badgeQuickStart: "البدء السريع",
    qsTitle: "جاهز للعمل خلال 60 ثانية",
    qsDesc: "بدون أي إعدادات معقدة أو حسابات أو اتصال بالإنترنت.",
    tabGitClone: "نسخ عبر Git (مستحسن)",
    tabBatch: "ملف تشغيل مباشر (Batch)",
    btnCopy: "نسخ الأوامر",
    step1Title: "تشغيل على الكمبيوتر",
    step1Desc: "اضغط مرتين على start-controller.bat أو شغّل npm start. سيقوم AltDeck ببناء ملف C# تلقائياً.",
    step2Title: "فتح على التابلت",
    step2Desc: "افتح متصفح سفاري أو كروم على جهازك اللوحي واكتب عنوان IP المحلي الظاهر في الشاشة.",
    step3Title: "إضافة للشاشة الرئيسية",
    step3Desc: "اختر إضافة للشاشة الرئيسية للاستمتاع بتطبيق كامل بدون أشرطة متصفح.",

    creatorTag: "تطوير وبرمجة",
    creatorBio: "مهندس برمجيات ونظم متكاملة مهتم بالأنظمة فائقة السرعة وواجهات الاستجابة اللحظية وتقنيات ويندوز المنخفضة.",
    btnViewAltdeck: "عرض مستودع AltDeck",
    footerCopy: "مرخص بموجب ترخيص MIT المفتوح. صُمم للمطورين ومنشئي المحتوى ومحبي الإنتاجية.",
    footerTop: "الرجوع للأعلى ↑",
    footerSource: "الكود المصدري",

    modalConfirmTitle: "تأكيد إعادة التشغيل",
    modalConfirmDesc: "بدأ العد التنازلي الآمن. في بيئة العمل الحقيقية، سيعيد الكمبيوتر التشغيل بعد:",
    btnDismiss: "إغلاق التجربة",
    btnAbort: "إلغاء الأمر (shutdown /a)",

    toastScreenOff: "🖥️ تم إطفاء الشاشات (مع بقاء الكمبيوتر يعمل)",
    toastProject: "📺 تم فتح قائمة شاشة العرض (Win + P)",
    toastNightLight: "🌙 تم تبديل الوضع الليلي",
    toastCalc: "🧮 تم تشغيل الآلة الحاسبة",
    toastLaunch: "🚀 تم تشغيل: ",
    toastLeftClick: "🖱️ لوحة اللمس: نقرة يسار",
    toastMiddleClick: "🖱️ لوحة اللمس: نقرة وسط",
    toastRightClick: "🖱️ لوحة اللمس: نقرة يمين",
    toastDoubleClick: "⚡ تم تنفيذ نقرة مزدوجة",
    toastDragLock: "🔒 تم تبديل وضع تثبيت السحب",
    toastOpenFolder: "📂 تم فتح مجلد AltDeck Transfers على سطح المكتب",
    toastLock: "🔒 تم قفل شاشة ويندوز (Win + L)",
    toastSleep: "💤 تم الدخول في وضع السكون",
    toastAbort: "🛑 تم إلغاء أمر إيقاف التشغيل بنجاح (shutdown /a)",
    toastRestartExplorer: "🔄 تم إعادة تشغيل مستكشف ويندوز (Explorer) بنجاح!",
    toastRestartAudio: "🎧 تم إعادة تشغيل خدمة الصوت بنجاح!"
  }
};

// Current Active Language (Default to 'en', or read from localStorage)
let currentLang = localStorage.getItem('altdeck_landing_lang') || 'en';
if (!TRANSLATIONS[currentLang]) currentLang = 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS['en'][key] || key;
}

function applyLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('altdeck_landing_lang', lang);

  // Set document dir and lang
  const isRtl = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.body.dir = isRtl ? 'rtl' : 'ltr';

  // Update switcher buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  // Update all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (TRANSLATIONS[lang][key]) {
      el.textContent = TRANSLATIONS[lang][key];
    }
  });

  // Re-adjust directional labels
  const micBtn = document.getElementById('demo-mic-toggle');
  if (micBtn) {
    micBtn.textContent = micIsLive ? t('btnMuteMic') : t('btnUnmuteMic');
  }
}

// Setup Language Switcher Click Handlers
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    applyLanguage(lang);
    playClickSound(800, 0.04, 'sine');
  });
});

// Initial Language Apply
applyLanguage(currentLang);

// --- 2. Web Audio Synthesizer (Zero-Asset Tactile Audio) ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playClickSound(freq = 600, duration = 0.03, type = 'sine') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playChimeSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.06, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.22);
    });
  } catch (e) {}
}

// Global click feedback on buttons
document.addEventListener('click', (e) => {
  const target = e.target.closest('button, .demo-app-tile, .toggle-tile, .mode-tab, .demo-drop-zone');
  if (target) {
    playClickSound(580, 0.03, 'triangle');
  }
});

// --- 3. Interactive Mode Switcher Tabs ---
const modeTabs = document.querySelectorAll('.mode-tab');
const modePanels = document.querySelectorAll('.sandbox-panel');

modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const targetMode = tab.getAttribute('data-mode');

    modePanels.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === `panel-${targetMode}`) {
        panel.classList.add('active');
      }
    });

    playClickSound(750, 0.04, 'triangle');
  });
});

// --- 4. Stream Deck Master Volume & Mic Simulator ---
const volSlider = document.getElementById('demo-vol-slider');
const volBadge = document.getElementById('demo-vol-val');

if (volSlider && volBadge) {
  volSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    volBadge.textContent = `${val}%`;
  });
}

function setDemoVol(val) {
  if (volSlider && volBadge) {
    volSlider.value = val;
    volBadge.textContent = `${val}%`;
    triggerToast(`${t('demoVolTitle')}: ${val}%`);
  }
}

let micIsLive = true;
function toggleDemoMic() {
  micIsLive = !micIsLive;
  const micIcon = document.getElementById('demo-mic-icon');
  const micTitle = document.getElementById('demo-mic-title');
  const micBtn = document.getElementById('demo-mic-toggle');

  if (micIsLive) {
    micIcon.className = 'mic-icon-circle on-air';
    micTitle.textContent = t('micOnAir');
    micBtn.className = 'btn-toggle-mic live';
    micBtn.textContent = t('btnMuteMic');
    triggerToast(t('micOnAir'));
    playClickSound(800, 0.04, 'sine');
  } else {
    micIcon.className = 'mic-icon-circle';
    micTitle.textContent = t('micMuted');
    micBtn.className = 'btn-toggle-mic muted';
    micBtn.textContent = t('btnUnmuteMic');
    triggerToast(t('micMuted'));
    playClickSound(400, 0.05, 'sawtooth');
  }
}

// --- 5. Interactive Trackpad Pro Simulation ---
const trackpadArea = document.getElementById('demo-trackpad-surface');
const cursorPointer = document.getElementById('demo-cursor');

if (trackpadArea && cursorPointer) {
  const updateCursor = (x, y) => {
    const rect = trackpadArea.getBoundingClientRect();
    const relX = x - rect.left;
    const relY = y - rect.top;
    cursorPointer.style.display = 'block';
    cursorPointer.style.left = `${relX}px`;
    cursorPointer.style.top = `${relY}px`;
  };

  trackpadArea.addEventListener('mousemove', (e) => {
    updateCursor(e.clientX, e.clientY);
  });

  trackpadArea.addEventListener('mouseleave', () => {
    cursorPointer.style.display = 'none';
  });

  trackpadArea.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      updateCursor(e.touches[0].clientX, e.touches[0].clientY);
    }
  });

  trackpadArea.addEventListener('click', () => {
    triggerToast(t('toastLeftClick'));
    playClickSound(950, 0.03, 'triangle');
  });
}

function setSpeed(btn, label) {
  document.querySelectorAll('#panel-trackpad .demo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  triggerToast(`${t('labelPointerSpeed')}: ${label}`);
}

// --- 6. Numpad Calculator Simulator ---
let numpadBuffer = '0';
const numpadScreen = document.getElementById('numpad-screen-val');

function pressNum(key) {
  playClickSound(700, 0.03, 'triangle');
  if (key === 'C') {
    numpadBuffer = '0';
  } else if (key === 'BS') {
    numpadBuffer = numpadBuffer.length > 1 ? numpadBuffer.slice(0, -1) : '0';
  } else if (key === 'ENT') {
    try {
      numpadBuffer = String(eval(numpadBuffer.replace(/×/g, '*').replace(/÷/g, '/')));
    } catch (e) {
      numpadBuffer = 'Error';
    }
  } else {
    if (numpadBuffer === '0' || numpadBuffer === 'Error') {
      numpadBuffer = key;
    } else {
      numpadBuffer += key;
    }
  }
  if (numpadScreen) numpadScreen.textContent = numpadBuffer;
}

function sendDemoType() {
  const input = document.getElementById('demo-type-input');
  if (input && input.value.trim()) {
    triggerToast(`⌨️ "${input.value.trim()}"`);
    input.value = '';
    playClickSound(1000, 0.04, 'sine');
  }
}

// --- 7. AirDrop Beam Simulator ---
let isUploading = false;
function simulateDrop() {
  if (isUploading) return;
  isUploading = true;
  const progressWrap = document.getElementById('demo-drop-progress');
  const progressFill = document.getElementById('demo-drop-fill');
  const transfersList = document.getElementById('demo-transfers-list');

  progressWrap.style.display = 'block';
  progressFill.style.width = '0%';

  let percent = 0;
  const interval = setInterval(() => {
    percent += 10;
    progressFill.style.width = `${percent}%`;

    if (percent >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        progressWrap.style.display = 'none';
        isUploading = false;
        playChimeSound();
        triggerToast('📂 File Received! Saved to Desktop/AltDeck Transfers');

        const newRow = document.createElement('div');
        newRow.className = 'transfer-row';
        newRow.innerHTML = `<span>📷 Photo_${Date.now().toString().slice(-4)}.jpg</span><span class="file-size">3.6 MB</span>`;
        if (transfersList) {
          transfersList.prepend(newRow);
        }
      }, 250);
    }
  }, 60);
}

// --- 8. Power & Safety Countdown Modal Simulation ---
let modalCountdownInterval = null;
function startSafetyModal(action) {
  const modal = document.getElementById('safety-modal');
  const title = document.getElementById('modal-title');
  const timer = document.getElementById('modal-timer');

  title.textContent = `${action}`;
  modal.style.display = 'flex';
  playClickSound(300, 0.08, 'sawtooth');

  let seconds = 30;
  timer.textContent = `${seconds}s`;

  if (modalCountdownInterval) clearInterval(modalCountdownInterval);
  modalCountdownInterval = setInterval(() => {
    seconds--;
    timer.textContent = `${seconds}s`;
    if (seconds <= 0) {
      clearInterval(modalCountdownInterval);
      closeSafetyModal();
      triggerToast(`⚠️ Live mode executes: ${action}`);
    }
  }, 1000);
}

function closeSafetyModal() {
  const modal = document.getElementById('safety-modal');
  if (modal) modal.style.display = 'none';
  if (modalCountdownInterval) clearInterval(modalCountdownInterval);
}

function abortCountdownDemo() {
  closeSafetyModal();
  triggerToast(t('toastAbort'));
  playClickSound(880, 0.06, 'sine');
}

// --- 9. Toast Notification Engine ---
let toastTimeout = null;
function triggerToast(msg) {
  const toast = document.getElementById('landing-toast');
  if (!toast) return;

  toast.textContent = msg;
  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// --- 10. Copy Quick Start Code Snippet ---
function copyCodeSnippet() {
  const snippet = document.getElementById('code-snippet');
  const copyText = document.getElementById('copy-text');
  if (!snippet) return;

  navigator.clipboard.writeText(snippet.textContent.trim()).then(() => {
    copyText.textContent = currentLang === 'ar' ? 'تم النسخ!' : (currentLang === 'fr' ? 'Copié !' : 'Copied!');
    triggerToast(currentLang === 'ar' ? '📋 تم نسخ الأوامر للحافظة' : '📋 Code copied to clipboard');
    playClickSound(900, 0.04, 'sine');
    setTimeout(() => {
      copyText.textContent = t('btnCopy');
    }, 2500);
  });
}

function switchCodeTab() {
  const snippet = document.getElementById('code-snippet');
  if (snippet) {
    snippet.textContent = `# Windows 1-Click Batch Quick Start
# 1. Download Repository ZIP from GitHub
# 2. Extract to any folder on your PC
# 3. Double-click:
start-controller.bat

# AltDeck will auto-compile the native C# helper
# and display your tablet connection address!`;
  }
}
