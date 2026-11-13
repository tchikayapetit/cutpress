/* English / French. English text is the key: the page is written in English and this
   file translates it. A DOM pass translates every known text, placeholder and tooltip,
   and a MutationObserver keeps newly drawn parts translated. Code that builds text uses
   I18N.t('English text', { vars }). */
(function () {
  const FR = {
    // header & modes
    'Word cut': 'Mot', 'Photo cut': 'Photo', 'Sound library': 'Bibliothèque sonore', 'Mode': 'Mode', 'Close': 'Fermer',
    'Type a line, pick the word, and it flies through real-looking newspapers, magazines and books.': 'Écrivez une phrase, choisissez le mot, et il traverse de vrais journaux, magazines et livres.',
    'Your photo gets printed in newspaper after newspaper, cut on the beat.': 'Votre photo est imprimée de journal en journal, coupée en rythme.',
    'Your words': 'Vos mots', 'Your photo': 'Votre photo', 'Type a short line': 'Écrivez une courte phrase',
    'Tap the word to highlight. Pick several to cut between them.': 'Touchez le mot à surligner. Choisissez-en plusieurs pour alterner.',
    'Drop a photo here or tap to choose': 'Déposez une photo ici ou touchez pour choisir', 'Add another photo': 'Ajouter une autre photo',
    'Headline printed above the photo': 'Titre imprimé au-dessus de la photo', 'e.g. Local bakery opens its doors': 'ex. Une boulangerie ouvre ses portes',
    'Pick the papers': 'Choisissez les journaux', 'Shuffle': 'Mélanger', 'All': 'Tous', 'Select all shown': 'Tout sélectionner', 'Clear shown': 'Tout effacer',
    '{n} of {total} selected': '{n} sur {total} sélectionnés',
    'Video shape': 'Format vidéo', 'Highlight': 'Surlignage', 'Yellow highlighter': 'Surligneur jaune', 'Pink highlighter': 'Surligneur rose', 'Green highlighter': 'Surligneur vert',
    'Blue highlighter': 'Surligneur bleu', 'Red pen underline': 'Soulignement au stylo rouge', 'Red pen circle': 'Cercle au stylo rouge',
    'Length & speed': 'Durée et vitesse', 'Use our default': 'Valeurs par défaut', 'Video length': 'Durée de la vidéo', 'Cut speed': 'Vitesse des coupes',
    '{n} cuts/s': '{n} coupes/s', 'Slow (left) to very fast (right). With music, the speed locks to the beat.': 'Lent (gauche) à très rapide (droite). Avec de la musique, la vitesse suit le rythme.',
    'Old paper look (sepia, faded, grainy)': 'Effet vieux papier (sépia, délavé, granuleux)',
    'Sound': 'Son', 'Library →': 'Bibliothèque →', 'No music': 'Pas de musique', 'Sound effects only': 'Effets sonores seulement', 'Change': 'Changer',
    'Track waveform. Click to set the drop point.': 'Forme d’onde. Cliquez pour placer le point de chute.',
    'The red line is where the cut lands. Click the waveform to move it.': 'La ligne rouge est l’endroit où la coupe tombe. Cliquez sur l’onde pour la déplacer.',
    'On every cut': 'À chaque coupe', 'more': 'plus', 'On the last frame': 'Sur la dernière image', 'No sound': 'Aucun son',
    'Make my video': 'Créer ma vidéo', 'Made in your browser and saved to your downloads. Nothing is uploaded.': 'Créée dans votre navigateur et enregistrée dans vos téléchargements. Rien n’est envoyé.',
    'Share last video': 'Partager la dernière vidéo', 'Video preview': 'Aperçu vidéo', 'Play preview': 'Lire l’aperçu', 'Pause preview': 'Mettre en pause', 'Timeline': 'Chronologie',
    'Preview': 'Aperçu', 'Pause': 'Pause',
    'More options': 'Plus d’options', 'Quick looks': 'Styles rapides', 'Classic': 'Classique', 'Breaking news': 'Flash info', 'Archive': 'Archives', 'Magazine': 'Magazine',
    'Business': 'Affaires', 'Top secret': 'Top secret', 'Afro promo': 'Promo afro',
    'Fast cuts across newspapers and books, paper sound': 'Coupes rapides entre journaux et livres, bruit de papier',
    'Newspapers and tabloids, news theme': 'Journaux et tabloïds, thème info', 'Old papers and typed memos, cinematic': 'Vieux journaux et notes tapées, cinématique',
    'Glossy pages, house beat': 'Pages glacées, rythme house', 'Financial papers and reports': 'Presse financière et rapports', 'Typed memos, typewriter keys': 'Notes tapées, touches de machine à écrire',
    'Tabloids and magazines, Afrobeats': 'Tabloïds et magazines, Afrobeats',
    'Ending': 'Fin', 'Last cut': 'Dernière coupe', 'Front page': 'Une', 'Depth blur': 'Flou de profondeur', 'Zoom': 'Zoom', 'Motion blur': 'Flou de mouvement', 'Text size': 'Taille du texte',
    'Hold at end': 'Pause finale', 'Tempo': 'Tempo', 'Music volume': 'Volume de la musique', 'Effects volume': 'Volume des effets', 'Speed up': 'Accélérer', 'Riser': 'Montée',
    'Shake': 'Secousse', 'Flash': 'Flash', 'Film grain': 'Grain de film', 'Vignette': 'Vignettage', 'CAPITALS': 'MAJUSCULES', 'Loop preview': 'Aperçu en boucle',
    'Your brand or paper name (replaces the mastheads)': 'Votre marque ou nom de journal (remplace les titres)', 'e.g. Douala Daily': 'ex. Douala Quotidien',
    'Caption / sub-headline': 'Légende / sous-titre', 'e.g. Opening this Friday at 8pm': 'ex. Ouverture ce vendredi à 20 h', 'Front page style': 'Style de la dernière page',
    'Same as last cut': 'Comme la dernière coupe', 'Own highlight color': 'Couleur de surlignage perso', 'Use own color': 'Utiliser ma couleur', 'Highlight color': 'Couleur de surlignage',
    'Logo on the front page': 'Logo sur la dernière page', 'Remove logo': 'Retirer le logo', 'Quality': 'Qualité', '720p · fast': '720p · rapide', '1080p · HD': '1080p · HD',
    'Frame rate': 'Images par seconde', 'File type': 'Type de fichier', 'Several versions': 'Plusieurs versions', 'How many': 'Combien', 'Export': 'Exporter',
    'Project file': 'Fichier de projet', 'Save': 'Enregistrer', 'Open': 'Ouvrir',
    // library
    'Sound effects': 'Effets sonores', 'Music': 'Musique', 'Search sounds': 'Rechercher un son', 'Search: paper, camera, typewriter, afro, dark…': 'Rechercher : papier, appareil photo, machine à écrire, afro, sombre…',
    'Every sound is created on your device, free to use in your videos, including commercial work.': 'Chaque son est créé sur votre appareil, libre d’usage dans vos vidéos, y compris commerciales.',
    'Selected': 'Choisi', 'Favorites': 'Favoris', 'Use': 'Utiliser', 'Upload': 'Importer', 'Upload my own track': 'Importer ma propre musique',
    'MP3, WAV or M4A. Tempo and drop are detected for you.': 'MP3, WAV ou M4A. Le tempo et le point de chute sont détectés pour vous.',
    'Only sound effects': 'Effets sonores seulement', 'Silence for this moment': 'Silence à ce moment', 'Every cut': 'Chaque coupe', 'Last frame': 'Dernière image',
    'Tap the heart on a sound to save it here.': 'Touchez le cœur sur un son pour le garder ici.', 'No sounds match your search.': 'Aucun son ne correspond à votre recherche.',
    'Download WAV': 'Télécharger en WAV', 'Favorite': 'Favori', 'short': 'court',
    'Printing your video…': 'Impression de votre vidéo…', '· keep this tab open': '· gardez cet onglet ouvert', 'Cancel': 'Annuler',
    // groups & styles
    'Old front pages': 'Vieilles unes', 'Close-up print': 'Gros plan imprimé', 'Newspapers': 'Journaux', 'Magazines': 'Magazines', 'Web & screens': 'Web et écrans', 'Posters': 'Affiches', 'Desk & objects': 'Bureau et objets',
    'Newspaper': 'Journal', 'Old newspaper': 'Vieux journal', 'Tabloid': 'Tabloïd', 'Business paper': 'Journal économique', 'Book page': 'Page de livre', 'Report': 'Rapport', 'Typed memo': 'Note tapée',
    '1920s paper': 'Journal des années 1920', 'Sports page': 'Page sport', 'Local weekly': 'Hebdo local', 'Classifieds': 'Petites annonces', 'Clipping on desk': 'Coupure sur un bureau',
    'Weekend supplement': 'Supplément week-end', 'Fashion cover': 'Couverture mode', 'News weekly cover': 'Couverture newsmagazine', 'Magazine spread': 'Double page de magazine',
    'Music magazine': 'Magazine musique', 'Travel magazine': 'Magazine voyage', 'Celebrity weekly': 'Hebdo people', 'Business magazine': 'Magazine économie', 'Blog post': 'Article de blog',
    'News website': 'Site d’actualité', 'Photo post': 'Publication photo', 'Text post': 'Publication texte', 'Video page': 'Page vidéo', 'Phone news app': 'Appli d’actu mobile', 'TV news': 'Journal télévisé',
    'Wanted poster': 'Avis de recherche', 'Wanted · dead or alive': 'Recherché · mort ou vif', 'Wanted · western notice': 'Recherché · avis western', 'Wanted · ribbon': 'Recherché · ruban',
    'Wanted · name plate': 'Recherché · plaque', 'Wanted · action poster': 'Recherché · affiche d’action', 'Missing poster': 'Avis de disparition', 'Event poster': 'Affiche d’événement',
    'Vintage poster': 'Affiche vintage', 'Movie poster': 'Affiche de film', 'Pinboard': 'Tableau en liège', 'Book cover': 'Couverture de livre', 'Record sleeve': 'Pochette de disque',
    'Framed on wall': 'Encadré au mur', 'Photo booth strip': 'Bande de photomaton', 'Press badge': 'Badge presse', '1910s front page': 'Une des années 1910', '1930s front page': 'Une des années 1930',
    'EXTRA edition': 'Édition SPÉCIALE', '1960s front page': 'Une des années 1960', 'Modern front page': 'Une moderne', 'Red-top tabloid': 'Tabloïd à sensation', 'Pile of newspapers': 'Pile de journaux',
    'Archive table': 'Table d’archives', 'Newsstand spread': 'Kiosque à journaux',
    // sfx
    'Paper shuffle': 'Froissement de papier', 'Camera shutter': 'Déclencheur d’appareil photo', 'Film advance': 'Avance de pellicule', 'Polaroid': 'Polaroid', 'Flash pop': 'Éclair de flash',
    'Lens zoom': 'Zoom d’objectif', 'Click': 'Clic', 'Typewriter key': 'Touche de machine à écrire', 'Glitch': 'Bug numérique', 'Pop': 'Pop', 'Whoosh': 'Whoosh', 'Long whoosh': 'Long whoosh',
    'Swoosh up': 'Balayage montant', 'Swoosh down': 'Balayage descendant', 'Reverse cymbal': 'Cymbale inversée', 'Short riser': 'Montée courte', 'Long riser': 'Montée longue',
    'Downlifter': 'Descente', 'Tape stop': 'Arrêt de bande', 'Vinyl scratch': 'Scratch de vinyle', 'Bass hit': 'Coup de basse', 'Cinematic impact': 'Impact cinématique', 'Deep boom': 'Boom grave',
    'Sub drop': 'Chute de sub', 'Punch': 'Coup de poing', 'Door slam': 'Porte qui claque', 'Thud': 'Bruit sourd', 'Gong': 'Gong', 'Metal clang': 'Choc métallique', 'Page turn': 'Page tournée',
    'Paper rip': 'Papier déchiré', 'Rubber stamp': 'Tampon', 'Typewriter bell': 'Sonnette de machine à écrire', 'Keyboard typing': 'Frappe au clavier', 'Mouse click': 'Clic de souris',
    'Pencil scribble': 'Gribouillage au crayon', 'Digital stutter': 'Bégaiement numérique', 'Bit crush': 'Bit crush', 'Error buzz': 'Bip d’erreur', 'Beep': 'Bip', 'Laser': 'Laser',
    'Scanner': 'Scanner', 'Data beeps': 'Bips de données', 'Bubble': 'Bulle', 'Ding': 'Ding', 'Notification': 'Notification', 'Success chime': 'Carillon de réussite', 'Coin': 'Pièce',
    'Cash register': 'Caisse enregistreuse', 'Swipe': 'Balayage', 'Toggle': 'Interrupteur', 'Like': 'J’aime', 'Boing': 'Boing', 'Slide whistle up': 'Sifflet à coulisse montant',
    'Slide whistle down': 'Sifflet à coulisse descendant', 'Ba dum tss': 'Ba dum tss', 'Cowbell': 'Cloche à vache', 'Air horn': 'Corne de brume', 'Applause': 'Applaudissements',
    'Drum roll': 'Roulement de tambour', 'Cymbal crash': 'Coup de cymbale', 'Heartbeat': 'Battement de cœur', 'Clock tick': 'Tic d’horloge', 'Ticking clock': 'Horloge qui tictaque',
    'News sting': 'Jingle d’info', 'Countdown beeps': 'Bips de compte à rebours', 'Alarm': 'Alarme', 'Camera shutter (SLR)': 'Déclencheur (reflex)', 'Camera burst': 'Rafale d’appareil photo', 'Camera shutter (digital)': 'Déclencheur (numérique)',
    'Camera shutter (film)': 'Déclencheur (argentique)', 'Instant camera': 'Appareil instantané', 'Camera focus beep': 'Bip de mise au point', 'Typewriter bell (recorded)': 'Sonnette de machine à écrire (enregistrée)',
    'Page turn (recorded)': 'Page tournée (enregistrée)', 'Cash register (recorded)': 'Caisse enregistreuse (enregistrée)', 'Staple taps': 'Coups d’agrafeuse', 'recorded': 'enregistré',
    'Transitions': 'Transitions', 'Impacts': 'Impacts', 'Paper & office': 'Papier et bureau', 'Camera': 'Appareil photo', 'Glitch & digital': 'Bug et numérique', 'UI & notifications': 'Interface et notifications',
    'Fun & cartoon': 'Fun et dessin animé', 'Tension & news': 'Tension et info',
    'Trap': 'Trap', 'Drill': 'Drill', 'Phonk': 'Phonk', 'Afrobeats': 'Afrobeats', 'Amapiano': 'Amapiano', 'Lo-fi': 'Lo-fi', 'Cinematic': 'Cinématique', 'Piano & emotional': 'Piano et émotion',
    'Techno': 'Techno', 'House': 'House', 'Synthwave': 'Synthwave', 'Upbeat pop': 'Pop entraînante', 'Stomp & clap': 'Pieds et mains', 'News & suspense': 'Info et suspense',
    // tags
    'newspaper': 'journal', 'soft': 'doux', 'photo': 'photo', 'click': 'clic', 'analog': 'analogique', 'ratchet': 'cliquet', 'instant': 'instantané', 'motor': 'moteur', 'charge': 'charge', 'focus': 'mise au point',
    'tap': 'tapotement', 'retro': 'rétro', 'typing': 'frappe', 'digital': 'numérique', 'error': 'erreur', 'cute': 'mignon', 'fast': 'rapide', 'air': 'air', 'slow': 'lent', 'rise': 'montée', 'fall': 'chute',
    'suck': 'aspiration', 'build': 'montée en tension', 'tension': 'tension', 'drop': 'chute', 'dj': 'dj', 'deep': 'grave', 'trailer': 'bande-annonce', 'big': 'énorme', 'hit': 'coup', 'fight': 'combat',
    'heavy': 'lourd', 'low': 'bas', 'epic': 'épique', 'asian': 'asiatique', 'industrial': 'industriel', 'book': 'livre', 'tear': 'déchirure', 'collage': 'collage', 'office': 'bureau', 'approved': 'approuvé',
    'ding': 'ding', 'computer': 'ordinateur', 'writing': 'écriture', 'school': 'école', 'repeat': 'répétition', 'down': 'bas', 'wrong': 'faux', 'censor': 'censure', 'tone': 'tonalité', 'sci-fi': 'science-fiction',
    'zap': 'zap', 'tech': 'techno', 'hacker': 'pirate', 'water': 'eau', 'bell': 'cloche', 'bright': 'clair', 'phone': 'téléphone', 'message': 'message', 'win': 'victoire', 'happy': 'joyeux', 'game': 'jeu',
    'money': 'argent', 'sale': 'vente', 'switch': 'bouton', 'heart': 'cœur', 'social': 'réseaux', 'spring': 'ressort', 'cartoon': 'dessin animé', 'fail': 'échec', 'joke': 'blague', 'drums': 'batterie',
    'percussion': 'percussion', 'party': 'fête', 'hype': 'hype', 'crowd': 'foule', 'reveal': 'révélation', 'body': 'corps', 'time': 'temps', 'deadline': 'échéance', 'broadcast': 'diffusion', 'brass': 'cuivres',
    'start': 'départ', 'timer': 'minuteur', 'warning': 'alerte', 'urgent': 'urgent', 'energetic': 'énergique', 'confident': 'confiant', 'dark': 'sombre', 'night': 'nuit', 'flex': 'frime', 'gritty': 'brut',
    'tense': 'tendu', 'aggressive': 'agressif', 'car': 'voiture', 'gym': 'sport', 'dance': 'danse', 'warm': 'chaleureux', 'sunny': 'ensoleillé', 'groovy': 'groove', 'chill': 'détendu', 'study': 'étude',
    'calm': 'calme', 'morning': 'matin', 'nostalgic': 'nostalgique', 'suspense': 'suspense', 'heroic': 'héroïque', 'emotional': 'émouvant', 'hopeful': 'plein d’espoir', 'inspiring': 'inspirant',
    'tender': 'tendre', 'love': 'amour', 'driving': 'entraînant', 'club': 'club', 'intense': 'intense', 'fashion': 'mode', 'smooth': 'fluide', 'lounge': 'lounge', 'ads': 'pubs', 'upbeat': 'dynamique',
    'summer': 'été', 'corporate': 'entreprise', 'positive': 'positif', 'anthem': 'hymne', 'sport': 'sport', 'motivational': 'motivant', 'news': 'actualités', 'thriller': 'thriller',
    // toasts & dynamic
    'This browser cannot record video. Try Chrome, Edge or a recent Safari.': 'Ce navigateur ne peut pas enregistrer de vidéo. Essayez Chrome, Edge ou un Safari récent.',
    'No supported video format found in this browser.': 'Aucun format vidéo pris en charge dans ce navigateur.',
    'MP4 recording is not supported here, exporting WebM instead.': 'L’enregistrement MP4 n’est pas pris en charge ici, export en WebM à la place.',
    'Sharing files is not supported in this browser. Use the downloaded file.': 'Le partage de fichiers n’est pas pris en charge ici. Utilisez le fichier téléchargé.',
    'Exported {n} variations.': '{n} versions exportées.', 'Analyzing track…': 'Analyse de la musique…',
    'Detected ~{bpm} BPM. Drop set at {t}s. Click the waveform to move it.': '~{bpm} BPM détectés. Point de chute à {t} s. Cliquez sur l’onde pour le déplacer.',
    'Could not read that audio file.': 'Impossible de lire ce fichier audio.', 'Could not read {name}': 'Impossible de lire {name}', 'Project loaded.': 'Projet chargé.',
    'That file is not a CutPress match cut project.': 'Ce fichier n’est pas un projet CutPress.', 'Music added to your video.': 'Musique ajoutée à votre vidéo.',
    'Video export is not available in this browser. Try Chrome or Edge.': 'L’export vidéo n’est pas disponible dans ce navigateur. Essayez Chrome ou Edge.',
    'Set for {what}.': 'Défini pour : {what}.', 'Could not render this sound.': 'Impossible de générer ce son.',
    '{c} cuts · {s} cuts/s · {t}s · {w}×{h}': '{c} coupes · {s} coupes/s · {t} s · {w}×{h}', 'Your Photo': 'Votre photo', 'Photo {n}': 'Photo {n}', 'Remove photo': 'Retirer la photo',
    'Your track': 'Votre morceau', 'Install the app': 'Installer l’application', 'Install': 'Installer', 'How it works': 'Comment ça marche', 'Project opened.': 'Projet ouvert.', 'Settings loaded from the link.': 'Réglages chargés depuis le lien.', 'That link could not be read.': 'Ce lien n’a pas pu être lu.',
    'Link copied. It keeps your text and settings, not your photos.': 'Lien copié. Il garde votre texte et vos réglages, pas vos photos.', 'Copy this link:': 'Copiez ce lien :',
    'Name this project': 'Nom du projet', 'Save current': 'Enregistrer', 'Open': 'Ouvrir', 'Play': 'Lire', 'Download': 'Télécharger', 'Delete': 'Supprimer', 'No saved projects yet.': 'Aucun projet enregistré pour l’instant.',
    'Videos you make will appear here, kept on this device.': 'Les vidéos que vous créez apparaîtront ici, gardées sur cet appareil.', 'Project saved on this device.': 'Projet enregistré sur cet appareil.',
    'Kept on this device only · {used} used': 'Gardé uniquement sur cet appareil · {used} utilisés', 'Kept on this device only': 'Gardé uniquement sur cet appareil', 'My work': 'Mes créations', 'Projects': 'Projets', 'Videos': 'Vidéos',
    'Save project': 'Enregistrer le projet', 'My projects': 'Mes projets', 'My videos': 'Mes vidéos', 'Copy link': 'Copier le lien',
    'The link keeps your text and settings, not your photos. Projects and videos stay on this device.': 'Le lien garde votre texte et vos réglages, pas vos photos. Les projets et vidéos restent sur cet appareil.',
    'Sound credits': 'Crédits sonores', 'Made in your browser. Nothing is uploaded.': 'Créé dans votre navigateur. Rien n’est envoyé.',
    'Look': 'Aspect', 'Timing & motion': 'Rythme et mouvement', 'Audio': 'Audio', 'Branding': 'Marque', 'Look, timing, branding and export': 'Aspect, rythme, marque et export',
    'Capitals': 'Majuscules', 'Add a logo': 'Ajouter un logo', '720p': '720p', '1080p HD': '1080p HD', '30 fps': '30 i/s', '60 fps': '60 i/s', 'Light theme': 'Thème clair', 'Dark theme': 'Thème sombre', 'Language': 'Langue', 'Setting the type…': 'Composition en cours…',
    // page text
    'p.wanted': 'RECHERCHÉ', 'p.deadalive': 'MORT OU VIF', 'p.reward': 'RÉCOMPENSE', 'p.forcrimes': 'POUR INTERROGATOIRE DANS L’AFFAIRE DES CHRONIQUES PERDUES',
    'p.details': 'Connu pour son intelligence, sa rapidité et pour ne jamais être vu deux fois dans la même ville. Approcher avec prudence. Toute information est à communiquer au shérif.',
    'p.age': 'Âge : environ 45 ans', 'p.height': 'Taille : 1,85 m', 'p.hair': 'Cheveux : bruns', 'p.missing': 'DISPARU', 'p.extra': 'SPÉCIAL', 'p.final': 'DERNIÈRE',
  };

  const I = (window.I18N = { lang: 'en', FR, cbs: [] });
  I.t = (key, arg) => {
    let s = I.lang === 'fr' && FR[key] !== undefined ? FR[key] : typeof arg === 'string' ? arg : key;
    if (arg && typeof arg === 'object') s = s.replace(/\{(\w+)\}/g, (m, k) => (arg[k] !== undefined ? arg[k] : m));
    return s;
  };
  I.locale = () => (I.lang === 'fr' ? 'fr-FR' : 'en-GB');
  I.onchange = (fn) => I.cbs.push(fn);

  const SKIP = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'OUTPUT']);
  let busy = false;
  function tr(en) { return I.lang === 'fr' && FR[en] !== undefined ? FR[en] : en; }

  I.apply = (root) => {
    busy = true;
    try {
      const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentNode && !SKIP.has(n.parentNode.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        const cur = n.nodeValue;
        if (n._en !== undefined && cur !== n._en && cur !== n._tr) { delete n._en; delete n._tr; }
        const base = n._en !== undefined ? n._en : cur;
        const key = base.trim();
        if (!key || FR[key] === undefined) continue;
        const out = base.replace(key, tr(key));
        n._en = base; n._tr = out;
        if (n.nodeValue !== out) n.nodeValue = out;
      }
      for (const el of (root || document.body).querySelectorAll('[placeholder],[title],[aria-label],[alt]')) {
        for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {
          if (!el.hasAttribute(a)) continue;
          el._enA = el._enA || {};
          const cur = el.getAttribute(a);
          if (el._enA[a] === undefined || (cur !== el._enA[a] && cur !== tr(el._enA[a]))) el._enA[a] = cur;
          const out = tr(el._enA[a]);
          if (cur !== out) el.setAttribute(a, out);
        }
      }
    } finally { busy = false; }
  };

  let timer = null;
  I.watch = () => {
    new MutationObserver(() => {
      if (busy || I.lang === 'en') return;
      clearTimeout(timer);
      timer = setTimeout(() => I.apply(), 30);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };

  I.set = (lang) => {
    I.lang = lang === 'fr' ? 'fr' : 'en';
    document.documentElement.lang = I.lang;
    try { localStorage.setItem('cutpress.lang', I.lang); } catch (e) {}
    if (window.CORPUS && window.CORPUS_SET) window.CORPUS_SET(I.lang);
    for (const fn of I.cbs) { try { fn(I.lang); } catch (e) { console.error(e); } }
    I.apply();
  };

  I.init = () => {
    let l = null;
    try { l = localStorage.getItem('cutpress.lang'); } catch (e) {}
    if (!l) l = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
    I.lang = l;
    document.documentElement.lang = l;
    if (window.CORPUS_SET) window.CORPUS_SET(l);
    I.watch();
    I.apply();
  };
})();
