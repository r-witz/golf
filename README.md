# P’tits Trous

Minigolf multijoueur dans le navigateur. Ce dépôt est la **base propre** du jeu, réduite à
l'essentiel : un serveur Go optimisé, le moteur physique et ses modificateurs (pads, bumpers,
téléporteurs, zones, obstacles mobiles…), un pool de 35 trous dont deux mondes de plusieurs trous (« Le pool de trous »), des pouvoirs (« Les pouvoirs »), un client
avec ses écrans d'avant-partie (accueil, salles, salon) et une vue 3D minimale.

Le prototype d'origine (Node) et la première version Go complète (63 cartes, client Three.js)
sont archivés à côté, dans `../trou-normand-prototype/` (`v2/` pour la version Go complète).

## Lancer

```sh
go run .                       # http://localhost:3000 : le jeu
DEV_MAPS=1 go run .            # pour construire les trous : chaque trou est relu dans maps/ quand une salle le lance
docker build -t trou-normand . && docker run -p 3000:3000 trou-normand
```

Il n'y a plus de tests dans le dépôt (choix du moment). Ils sont archivés dans
`../trou-normand-prototype/lean-tests/` : voir « Tests archivés » plus bas.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT`, `HOST` | `3000`, `0.0.0.0` | adresse d'écoute |
| `MAX_ROOMS` | `200` | salles ouvertes en même temps |
| `TRUST_PROXY` | – | `1` derrière **un** reverse proxy : l'IP vient de `X-Forwarded-For` |

À l'arrêt (`SIGTERM`), chaque joueur connecté reçoit la fermeture 1012 (« redémarrage ») ; les
clients se reconnectent ensuite, chacun après un délai en partie aléatoire. Les salles, en
mémoire, sont perdues.

Une seule dépendance : `gorilla/websocket` (poignée de main et lecture).

## Docker

Image `scratch` : rien d'autre que le binaire statique, client compris (7,6 Mo ; image de
10,9 Mo selon `docker images`, 3,3 Mo compressée), utilisateur non root, aucun fichier écrit. Elle tourne
telle quelle en lecture seule et sans capacités :

```sh
docker run --read-only --cap-drop ALL --security-opt no-new-privileges -p 3000:3000 trou-normand
```

- le binaire est compilé sans HTTP/2 (`-tags nethttpomithttp2`) : le serveur ne parle que
  HTTP/1.1 en clair, le TLS est l'affaire du reverse proxy ;
- le healthcheck est le binaire lui-même (`trou-normand healthcheck`), qui vérifie seulement
  que le port accepte une connexion. Le conteneur est déclaré sain en 1 s ;
- la construction joue chaque trou (`tools/verify`, ~65 s pour 75 trous sur 20 cœurs, davantage sur un petit serveur) et s'arrête si un trou est refusé, puis
  redessine tous les aperçus (`tools/previews`, ~1,5 s, avec le Chromium de Debian installé dans
  l'étape de construction) : rien n'est à vérifier ni à dessiner à la main avant ;
- les caches de Go sont gardés entre deux constructions (BuildKit) : seul ce qui a changé est
  recompilé. Un changement du README ne reconstruit rien ;
- il faut Docker 25 ou plus récent (`--start-interval`).

**En production**, `compose.yaml` lance le jeu seul, sur le port 3000 du serveur (réglages
facultatifs dans un fichier `.env` à côté : `PORT`, `MAX_ROOMS`, `TRUST_PROXY=1` seulement derrière un
reverse proxy). Pour lancer comme pour mettre à jour : `git pull && docker compose up -d --build`. Si
la construction échoue (un trou refusé), l'ancien conteneur continue de tourner. Le jeu ne parle que
HTTP en clair : pour HTTPS, un reverse proxy devant (qui laisse passer les WebSockets de `/ws`).

## Ce qu'il y a dedans

```
main.go               serveur HTTP : /ws, /healthz, les aperçus des trous (/previews/) et le client (/)
web/                  le client du jeu, embarqué dans le binaire (voir « Le client »)
internal/physics      le moteur : géométrie (hole.go, contact.go), simulation (world.go), modificateurs
                      (material.go, zone.go, effects.go, motion.go)
maps/                 les cartes, un trou par fichier JSON (voir « Les cartes et les modificateurs »), et leur chargement (maps.go)
tools/maps            les scripts qui écrivent ces cartes, un par trou (voir « Le pool de trous »)
tools/mapcheck        vérifie un seul trou pendant qu'on le construit, et simule des tirs
internal/game         salles et partie (hub, room, game), simulation d'un trou (sim, track, paths), protocole et connexions (proto, conn, shard)
tools/previews        dessine les aperçus des trous dans web/previews/ (Chrome headless), à la construction de l'image
tools/verify          joue chaque trou comme des joueurs et dit s'il est bon ; la construction de l'image le lance
```

Le serveur ne garde que le cœur : connexion et reconnexion (jeton de session), pseudo et couleur
de balle, salles nommées, publiques (dans la liste) ou privées (par code ou par lien), un
propriétaire par salle qui règle et lance les parties, tirer, score au nombre de coups (un coup de
pénalité quand la balle sort ou tombe dans un piège). Les trous du parcours s'enchaînent, puis
chacun voit le podium et le classement, et revient au salon quand il veut. Volontairement absent
pour l'instant : mots de passe.

Les réglages de la salle (`internal/game/settings.go`), choisis par le propriétaire au salon et
gardés par son navigateur pour sa prochaine salle ; une partie garde ceux avec lesquels elle a
commencé. Un réglage absent du message d'un client prend sa valeur par défaut (des réglages gardés
par un navigateur avant qu'un réglage nouveau existe le reçoivent ainsi) :

| Réglage | Valeurs | Par défaut |
| --- | --- | --- |
| salle | privée (hors de la liste, par code ou lien) ou publique | privée |
| joueurs connectés au plus | 2 à 16 (autant que de couleurs) | 8 |
| les balles se cognent | non : partout traversables ; oui : comme le trou le dit (un trou fait sans le reste) | oui |
| coups par trou | 1 à 20, ou selon le trou (8 s'il ne dit rien) | selon le trou |
| temps après le premier arrivé | 10 à 600 s | 60 s |
| temps par trou | 1 à 10 min | 3 min |
| parcours | au hasard : N trous tirés parmi ceux cochés (les trous d'un monde viennent ensemble, dans l'ordre) ; sur mesure : une liste dans l'ordre | 9 au hasard parmi tous |
| pouvoirs | oui ou non (voir « Les pouvoirs ») | oui |

**16 joueurs au plus**, autant que de couleurs. Mesuré le 18/11/2026 (une salle, chacun tire toutes
les 2,5 s, collisions, temps simulé), sur le trou le plus lourd (vent et aimants) : 2 ms au pire
pour un tir à 16, 12 ms à 32, 279 ms à 50 ; à 100, la salle ne suit plus le temps réel (un tir
bloque jusqu'à 56 s). En vrai, 10 salles de 32 bots sur ce trou : 37 % d'un cœur, 11,7 messages
par seconde et par joueur (chaque tir part à toute la salle).

Les règles de salle :

- **le propriétaire** est celui qui a ouvert la salle, et lui seul la règle et lance une partie. S'il s'en
  va, ou perd sa place (20 s après une coupure au salon, 10 min en partie), la salle passe au
  plus ancien des joueurs présents ;
- **le propriétaire** peut exclure un joueur, présent ou absent, au salon ou en partie : il sort
  de la salle et peut revenir avec le lien (pas de bannissement, par choix : sans compte joueur, un
  autre onglet le contournerait). Il peut aussi arrêter la partie (retour au salon, les scores des
  trous terminés restent) ;
- **quitter la salle** libère la place aussitôt ; qui revient avec le lien pendant la partie compte
  le maximum de coups sur les trous déjà joués, et sur le trou en cours s'il l'a quitté de
  lui-même pendant ce trou (il l'a abandonné : pas de second essai en sortant puis en revenant ;
  un joueur exclu, ou dont la place a été reprise, retrouve une balle neuve) ;
- **chacun peut abandonner un trou** : il compte le maximum de coups, sa balle reste là où elle
  est, en fantôme ;
- **un trou ne dure pas indéfiniment** : dès qu'un joueur l'a fini (dans le trou ou à court de
  coups, pas par abandon), les autres ont le temps réglé ; et il ne dure jamais plus que le temps
  par trou. Ensuite ceux qui n'ont pas fini comptent le maximum. Un joueur resté devant son écran
  sans jouer ne bloque donc plus personne ;
- **le nombre de joueurs réglé** compte les connectés : un absent qui revient alors que la salle
  s'est remplie perd sa place (erreur `full`). Les places gardées aux absents vont jusqu'à 14 de
  plus ; au-delà, un arrivant prend celle de l'absent parti le premier ;
- **deux joueurs connectés n'ont jamais la même couleur** (16 couleurs, 16 joueurs au plus) : chacun
  garde celle qu'il préfère si elle est libre, sinon reçoit la première libre. Un absent garde
  la sienne tant qu'il en reste une autre ; sinon un arrivant peut la prendre, et l'absent en
  change à son retour. La palette est dans `welcome`, un joueur n'envoie qu'un numéro ;
- **les noms sont facultatifs** (16 caractères pour un joueur, 24 pour une salle, nettoyés par
  le serveur). Sans nom, c'est le client qui écrit « Joueur 12 » ou « Salle K3F9P » ;
- **la liste des salles publiques** est donnée à la demande, hors d'une salle seulement : 50
  salles au plus, celles qui attendent des joueurs d'abord, puis celles en jeu, puis les
  complètes. Elle est refaite au plus une fois par seconde, quel que soit le nombre de demandes.
  Une salle passée en privée en sort, et une entrée choisie dans une liste d'avant est refusée
  (« Cette salle est devenue privée. ») ; par son code ou son lien, on y entre toujours.

Le protocole tient en douze messages client, huit messages serveur en JSON et une trame binaire,
les trajectoires des balles et ce qui va leur arriver, décrits en tête de
`internal/game/proto.go`.

## Ce que le client n'a pas à savoir

Le serveur détient toutes les règles et tous les nombres du jeu. Un client fait quatre choses :
caméra, graphismes, sons, interpolation entre deux positions d'une trajectoire. Il transforme
aussi le geste du joueur en un `shoot` : la visée reste chez lui (flèche oscillante comprise ;
c'est un élément de jeu, pas une protection, un client modifié peut toujours viser parfaitement).

| Le client n'a pas à… | Le serveur envoie |
| --- | --- |
| embarquer un trou ou une taille | la géométrie dans `hole`, avec `ballR`, `cupDepth`, `fps` et `pathStep` ; chaque trame de trajectoires porte le numéro de séquence du trou qu'elle décrit |
| deviner si son tir est parti | toujours une réponse : des trajectoires avec l'événement `shot` s'il est joué, l'erreur `shot` sinon |
| deviner qu'une balle a été replacée | un nouveau segment de trajectoire : la balle saute de la fin de l'un au début du suivant, sans interpolation |
| déduire ce qui arrive aux balles | des événements datés à l'image près : tir, dans le trou, sortie (+1 coup), plus de coups, et chaque rebond (sol, mur, poteau, bord du trou, autre balle) avec sa vitesse, pour les sons |
| compter ou classer | `total`, `rank` et `maxStrokes` dans `room` |

Le classement porte sur les trous terminés, donc les mêmes pour tout le monde : il ne bouge pas
pendant un trou. Les ex æquo partagent leur rang ; un joueur arrivé après la partie a le rang 0.

## Les trajectoires envoyées d'avance

Le serveur n'envoie pas la position des balles 30 fois par seconde. Il calcule l'avenir de
chaque balle **une seule fois**, jusqu'à ce qu'elle s'arrête (20 s au plus d'un coup), et c'est
ce calcul qui fait foi : il n'y a pas d'autre simulation. Chaque fois que quelque chose change
l'avenir (un tir, une arrivée, un départ, le début d'un trou), il envoie le résultat en une
trame : la trajectoire de chaque balle concernée (une position toutes les 2 images, soit 30 par
seconde) et tous les événements à venir avec leur numéro d'image. Le client rejoue ça sur
l'horloge du trou (numéro d'image / `fps`).

Un tir pendant qu'une autre balle roule ne pose pas de problème : le serveur recalcule depuis
l'image du tir et renvoie seulement les trajectoires qui changent, à partir de l'endroit où elles
changent. Les règles côté client tiennent en quatre lignes :

- un segment remplace tout ce qu'on savait de la balle à partir de sa première position ;
- on interpole entre deux positions d'un segment ;
- un segment qui commence là où la balle était déjà attendue à cette image prolonge la
  trajectoire ; tout autre segment est un saut (la balle reste où elle était, puis est là où il
  commence : c'est le replacement après une sortie) ;
- les événements annoncés pour après l'image de départ d'une trame sont annulés par cette trame,
  et ceux qu'elle annonce de nouveau ne sont pas rejoués si le client les a déjà joués.

Comment c'est fait (`sim.go`, `track.go`, `paths.go`) :

- **une piste par balle** (`track`) : où est la balle et ce qu'elle fait à chaque image
  (16 octets), la balle entière toutes les 32 images et à chaque image où elle en rencontre une
  autre, ce qui lui arrive (rebonds, sortie, trou) et les balles qu'elle rencontre. Entre deux
  balles entières, une balle n'a rencontré personne : la rejouer seule depuis la dernière la
  redonne exactement, sur n'importe quelle image (`sim.state`). Une seule fonction, `play`,
  calcule une image : la physique, puis les règles (sortie et replacement, entrée dans le trou,
  gel, nombre de coups). La physique est déterministe, le monde n'avance que par images entières
  et aucune règle ne dépend de l'heure ;
- **chaque balle avance seule** (`physics.World.Advance`, avec ses propres sous-pas). Deux balles
  se rencontrent quand leurs lignes droites sur l'image se croisent (`physics.Meet`). Les balles
  qui se rencontrent forment un groupe, rejoué ensemble sur l'image (`World.Together` : pas
  communs, chocs de toutes les paires après chaque pas) ; un groupe qui en rencontre un autre
  fusionne avec lui, jusqu'à ce qu'aucun n'en rencontre plus. Ce que devient une balle ne dépend
  donc que des balles qu'elle rencontre ;
- **un tir ne recalcule que ce qui peut changer** (`replan`) : la balle tirée, les balles qui
  passent près d'une balle changée, et celles dont la piste avait rencontré une balle qui a
  changé ou qui est partie, de proche en proche. Les autres gardent leur piste ;
- **la salle ne simule rien entre deux actions** : elle se réveille seulement quand un événement
  change les scores, quand le trou est fini, et 1 s avant la fin de ce qui est connu d'une balle
  qui roule encore, pour calculer la suite avant que les clients en aient besoin.

Il n'y a plus de contrôle pendant le jeu (choix assumé) : rien ne vérifie en production que les
pistes gardées sont celles qu'un calcul complet aurait données. Un essai fait pendant le
développement (test temporaire, pas gardé dans le dépôt, comme les autres) l'a vérifié bit à
bit : 300 parties de 2 à 10 joueurs, 12 216 tirs dont la moitié visent une autre balle, 1 307
départs et 1 224 arrivées en cours de trou, 17,5 millions d'images comparées à un calcul de
toutes les balles à chaque image, sans écart, y compris avec un horizon raccourci à 12 images
pour forcer les suites (150 parties). Deux passes identiques donnent le même résultat au bit
près. L'essai échoue si l'on retire la recherche des balles proches, les liens périmés ou le
saut vers la première image à refaire ; le quatrième garde-fou (proximité cherchée depuis toute
balle rejouée, pas seulement les balles changées) n'a pas pu être pris en défaut aux vitesses
actuelles. Sur ces 25 580 rencontres, deux balles se chevauchent de 0,13 rayon au plus, une
image, quand trois balles sont posées au même endroit (au départ) ; 9 images sur 17,5 millions
dépassent 0,02 rayon. Aucune balle n'a roulé plus de 7,3 s.
Depuis les pistes compactes, le même essai compare aussi, à chaque image, la balle rejouée
depuis la dernière balle entière gardée et ce que la piste dit d'elle : sans écart, avec les
mêmes parties au bit près qu'avant ce changement. Il échoue si une rencontre ne garde pas la
balle entière, ou si `sim.state` reprend une balle rejouée au-delà d'une balle entière plus
récente. Une balle seule suit exactement la même trajectoire qu'avec l'ancien moteur (819 tirs comparés
bit à bit) : seules les collisions entre balles ont changé.

Avant ce changement, un jeu réel tournait à côté de la prévision, comme contrôle. Ce qui suit a
été vérifié sur cette architecture précédente, pas refait depuis : la comparaison, bit à bit, de
ce qu'un client finit par croire avec ce que le jeu avait réellement fait (trace écrite par un
serveur instrumenté, compilé avec le détecteur de courses) :

| Essai | Positions comparées | Événements | Écarts |
| --- | --- | --- | --- |
| 4 joueurs, 90 s | 52 260 | 2 104 | 0 |
| 10 joueurs dans une salle, 90 s | 271 100 | 12 390 | 0 |
| arrivées et départs en continu, 4 passes | ≈ 100 000 chacune | ≈ 4 400 chacune | 0 |
| prévisions coupées toutes les 0,5 s (pour forcer les suites) | 35 252, puis 65 553 avec arrivées et départs | | 0 |

Les drapeaux (au repos, solide, dans le trou) étaient comparés aussi, sans écart.

Ce qu'il faut savoir :

- **un client modifié voit l'avenir** : où chaque balle va s'arrêter, dès le tir. Il ne peut
  rien en faire sur son propre tir (il est déjà joué), mais il connaît le résultat des autres
  avant de le voir ;
- **une trame arrive toujours un peu après son départ** : un tir est daté de l'image où le
  serveur l'a joué, et reçu 1 à 3 images plus tard (plus avec un réseau irrégulier). Un client
  naïf fait donc démarrer la balle un peu plus loin (16 à 26 cm en moyenne en local, 1 m au
  pire observé). Le client rattrape sans saut, voir
  « Le client » ;
- **la mémoire suit le mouvement** : une piste coûte environ 1,3 ko par seconde de mouvement
  prévue (16 octets par image, plus la balle entière toutes les 32 images et à chaque rencontre),
  et garde sa place d'un tir à l'autre. Mesuré à 2 000 bots : 88 à 93 Mo, contre 65 Mo avant
  les trajectoires calculées une seule fois (voir « Le serveur : où part le temps ») ;
- **une balle coincée ne roule pas indéfiniment** : une balle qui bouge depuis plus de 30 s sans
  toucher le sol (`maxMovingTime`, `Ball.Stuck`), coincée entre deux obstacles par exemple, est
  traitée comme sortie des limites : +1 coup, retour à son dernier point de repos. Le client
  l'affiche comme une pénalité (« Hors limites ! +1 »). Au sol, une balle qui bouge encore
  après 30 s est simplement mise au repos où elle est. Une balle qu'une force (vent, aimant)
  plaque contre un mur s'arrête aussi : seule une balle posée (départ, retour après pénalité) là où
  une force l'emporte est relancée ;
- **les modificateurs** gardent une balle sous `maxSpeed` (la recherche des balles proches en
  dépend) et ne dépendent que de la balle, du trou et du numéro d'image : voir « Les cartes et les
  modificateurs ».

## Les cartes et les modificateurs

Une carte est un trou par fichier JSON dans `maps/`, embarqué dans le binaire, dans l'ordre des
noms de fichier. Le serveur refuse de démarrer sur une carte fausse, en disant où :
`zone 0 speedpad: needs a speed in (0, 24]`, `collider 1: unknown material "lava"`,
`json: unknown field "sped"` (une faute de frappe n'est jamais ignorée).

**Ce qu'une carte ne peut pas faire.** Au-delà d'un JSON juste, le serveur refuse ce que le moteur
jouerait de travers ou qu'on ne pourrait pas jouer (`internal/physics/validate.go`, chaque règle
dit pourquoi) :

- un vecteur a trois nombres, rien ne suit le trou ; tout tient à 255 du centre (la grille de
  collisions et la précision des positions envoyées) ;
- le trou fait au moins 0,45 de rayon ; la gravité vaut au moins 1,6 (une balle lancée vers le haut
  retombe avant le filet de sécurité de 30 s) ; le `par` ne dépasse pas les coups permis ;
- un cylindre est debout (pas de `rot`) ; un mouvement a une phase dans [0, 1), une période de
  30 s au plus, et bouge ;
- rien sous le trou (sauf ce qui touche le dessous de son sol : un green surélevé) ni dans son
  puits (de son fond à une balle posée sur le bord), ni collider ni zone qui agit à l'entrée : la
  paroi et le fond attraperaient une balle. Le moteur, lui, n'attrape plus une balle passée sous le
  fond du trou (une balle qui tombe d'un green en île) ;
- deux zones qui agissent à l'entrée ne se chevauchent pas, sauf deux de `hazard`, `checkpoint`,
  `strokes`, `key` (pas deux `checkpoint`) : sinon leur effet dépendrait de leur ordre dans le
  fichier. Les zones de force (`wind`, `magnet`) se chevauchent librement ;
- une zone commence au sol et dépasse le centre d'une balle posée dessus (d'un peu plus que ce
  qu'une balle s'enfonce en une image) : sinon une balle qui roule n'y entre jamais ; une zone n'est
  pas sous le parcours sans rien dessous ; `once` ne va qu'aux zones qui marquent la balle
  (`hazard`, `checkpoint`, `strokes`, `key`) : un pad pris une fois manquerait à une
  balle replacée après une pénalité ; un bonus (`strokes`) est `once` ;
- le sol sous un point (départ, `at` d'un `checkpoint`, sortie de téléporteur, zone) est le plus
  haut à sa hauteur ou dessous : un point de reprise sous une passerelle est posé sous elle ;
- le départ et chaque point de reprise sont sur un sol plat, fixe, qui n'est pas une porte, hors du
  trou, d'aucun collider ni d'aucune zone qui agit à l'entrée (sauf le `checkpoint` lui-même), où
  aucune force ne pousse une balle posée et qu'aucun obstacle mobile n'atteint ; la sortie d'un
  téléporteur est au-dessus d'un sol, hors de tout collider ;
- une porte a sa clé et une clé sa porte ; le sol du trou n'est pas une porte ; un aimant plus fort
  que la résistance au roulement sous son point attire dans le trou.

**Chaque trou est vérifié.** `go run ./tools/verify` (la construction de l'image le lance, et
s'arrête si un trou est refusé ; on peut aussi le lancer à la main quand on a fini les cartes) joue chaque trou comme des joueurs, avec le vrai moteur et les vraies règles, et refuse un trou :

- s'il ne trouve pas de chemin jusqu'au trou dans le `par` (un joueur n'en trouverait pas non plus) ;
- s'il trouve un piège : un endroit où une balle peut s'arrêter et d'où l'on ne rejoint plus le trou ;
- s'il voit le moteur mal jouer : une zone qui avait quelque chose à faire et n'agit pas, une balle
  dans un collider (fixe ou mobile) ou qui traverse un mur, un tir qui roule jusqu'au filet de 30 s ;
- si une zone qui agit à l'entrée n'agit jamais (aucune balle ne peut y entrer) ;
- si une balle remise en place après une pénalité est de nouveau hors jeu moins de 2 s après, avant
  que son joueur puisse tirer (elle le serait pour toujours). Un obstacle qui envoie une balle au
  repos hors du parcours est un choix de la carte, pas une faute : la balle revient là d'où elle a
  été tirée, ou au dernier point de reprise (qu'aucun obstacle mobile ne peut atteindre).

Chaque refus dit où, combien de fois, et les tirs qui le montrent depuis le départ. Les mêmes cartes
et le même code donnent toujours le même verdict (75 trous en ~65 s ; un trou refusé faute de chemin
peut prendre une à deux minutes). Comment il s'y prend : `internal/game/verify.go`, et
`docs/verification-des-cartes.md`.

```json
{
  "name": "…", "tee": [x, y, z], "cup": {"x": 0, "y": 0, "z": -27, "r": 0.45},
  "maxStrokes": 10, "par": 3, "gravity": 18, "solo": false,
  "colliders": [ … ], "zones": [ … ]
}
```

`tee` est le centre de la balle (sol + 0,18), le trou est découpé dans un seul sol plat, droit et
fixe, et rien n'est dessous (ni collider plus bas qui atteint son cercle, ni sortie de téléporteur :
la paroi et le fond du trou y attraperaient une balle). Les règles du trou sont facultatives : coups au plus (8), `par` (3 : ce qu'un bon joueur y
joue, ce dont le client fait « Birdie ! », « Bogey »…, et qu'il annonce avec le nom du trou),
gravité (18), `solo` (les balles se traversent). Le client reçoit le trou tel quel dans le message `hole`.

**Colliders.** `shape` 0 boîte (`h` : demi-tailles) ou 1 cylindre vertical (`r`, `hh` : rayon,
demi-hauteur) ; `kind` 0 sol, 1 mur, 2 poteau (le son du choc) ; `c` le centre, `rot` les angles
d'Euler XYZ en radians. Facultatifs :

- `material` : `grass`, `wall`, `post` (ceux par défaut, selon `kind`), `ice` (glisse),
  `sand` (freine fort, et une balle qui y tombe ne rebondit pas), `bumper` (renvoie la balle à 9 u/s
  quelle que soit sa vitesse), `jelly` (une gelée, un château gonflable : une balle qui y tombe rebondit
  haut, 0,82 de sa vitesse, et y roule lentement). L'eau n'est pas un sol : c'est une zone `hazard`. Un bord est un mur classique ou un
  bumper. La table est dans `internal/physics/material.go` ;
- `key` (1 à 8) : une porte, que traversent les balles qui ont cette clé ;
- `motion` : le collider bouge sans fin, selon l'heure du trou et rien d'autre. Avec
  u = t / `period` + `phase` : il glisse de `move`·(1 − cos 2πu)/2 (aller-retour), et tourne autour
  de `axis` passant par `pivot` (qui glisse avec lui) de 2πu, ou de `swing`·sin 2πu (balancier).
  Le client dessine le même mouvement avec les mêmes formules, sur l'horloge du trou.

**Zones.** Un volume que traverse le centre de la balle, de même forme qu'un collider (`shape`,
`c`, `rot`, `h` ou `r`/`hh`, 0,2 d'épaisseur au moins), immobile, avec un `type`, ses `params`,
et `once` pour n'agir qu'une fois par balle et par trou. 64 zones au plus par trou.

| `type` | `params` | Effet |
| --- | --- | --- |
| `speedpad` | `dir`, `speed` | un accélérateur : la balle garde sa direction et repart à `speed` au moins, ou à 1,2 fois sa vitesse si elle allait déjà plus vite (24 au plus). Seule une balle qui va dans le sens de `dir` (à 60° près) est relancée : une balle en travers ou à contre-sens passe sans rien, sinon un accélérateur entre deux murs la renverrait sans fin. Une balle presque immobile au sol (qui tombe dessus) part dans le sens de `dir` |
| `jumppad` | `speed` | vitesse verticale |
| `launcher` | `v` | vitesse imposée : canon, catapulte (le chemin envoyé montre l'arc) |
| `teleport` | `to`, `turn` | la balle sort en `to` à la même vitesse, tournée de `turn` radians |
| `hazard` | | eau, lave, vide : +1 coup, retour au dernier point de reprise |
| `checkpoint` | `at` | nouveau point de reprise (posé sur le sol le plus haut à la hauteur de `at` ou dessous) |
| `strokes` | `add` | un bonus : retire des coups (`add` de −8 à −1, souvent −1), toujours `once` |
| `key` | `key` | donne une clé (voir les portes) |
| `wind` | `accel` | poussée continue : vent, ventilateur ; une zone fine (0,3 de haut au plus) est un tapis roulant |
| `magnet` | `at`, `accel` | attire (ou repousse) horizontalement vers `at` |
| `gravity` | `g` | la gravité devient `g` dans la zone (1,6 à 54) : un saut y flotte et va plus loin, une pente y tire moins. Une zone haute au-dessus d'un vide fait un pont d'apesanteur |
| `powerup` | | une caisse à pouvoir : le joueur reçoit un pouvoir tiré au hasard si la salle joue avec, toujours `once` (voir « Les pouvoirs ») |
| `vortex` | `at`, `accel`, `swirl` | un trou noir, un tourbillon : attire vers `at` comme un aimant et fait tourner la balle autour (`swirl` > 0 : sens inverse des aiguilles d'une montre vu de dessus). Plus fort que la résistance au roulement, il doit avoir le trou en son centre ; son `swirl` sous 2,2 garantit qu'une balle ne tourne pas sans fin |

Toute vitesse reste sous 24 u/s, toute poussée sous 40 u/s². Une poussée plus faible que la
résistance au roulement (2,2 u/s² sur l'herbe) ne fait pas repartir une balle arrêtée.

**Les mondes** (2026-11-26) : un monde est un petit parcours de plusieurs trous sur un même terrain, plus
grand et plus dur qu'un trou seul. Chacun de ses trous est une carte à part entière, avec tout le terrain, son
départ et son trou à lui, `world` (le nom du monde), `stage` (sa place, à partir de 1) et `flags` (où sont les
autres trous du monde : le client y plante un drapeau blanc, rien n'est creusé). Le départ d'un trou est à
côté du green du précédent ; le décor est le même d'un trou à l'autre. Tirés au hasard, les trous d'un monde
viennent ensemble et dans l'ordre. Un script de `tools/maps/holes/` fait tout le monde (`stages` et `stage`
dans `lib.mjs`) : `build.mjs` écrit un fichier par trou (`w1-le-volcan-1.json`...). Une zone porte le numéro
du trou qu'elle sert (`stage`) : `tools/verify` ne demande d'atteindre que celles du trou vérifié. Deux
mondes de trois trous : **Le Volcan** (la lave à la place de l'eau, une rampe d'obsidienne qui glisse comme
la glace, un cratère avec une cheminée qui souffle et des bulles de lave autour du trou) et **L'Île au Trésor**
(un lagon aux requins, la jungle, un pont de planches sans rambarde vers le rocher au trésor, le canon du
bateau).

**Les pouvoirs** (2026-11-26), quand la salle joue avec (réglage du salon, oui par défaut). Chaque joueur en
a deux en main au plus : un tiré au hasard au début de chaque trou, d'autres dans les caisses (zones
`powerup`). Il les joue par un clic sur leur case en bas de l'écran ou les touches 1 et 2 (message
`power`). Ils font partie de l'état de la balle sur sa piste (`golfer`, `internal/game/powers.go`) : ce
qu'ils font est calculé d'avance et rejoué à l'identique, comme le reste ; un pouvoir actif sur une balle est
dans `physics.Ball.Power` et dure jusqu'à son arrêt.

| Pouvoir | Pour | Effet |
| --- | --- | --- |
| Super coup | son prochain tir | part 1,5 fois plus vite (24 au plus) |
| Saut | son prochain tir | bondit (7,5 u/s vers le haut) : par-dessus un muret, à jouer près de l'obstacle |
| Fantôme | son prochain tir | traverse les autres balles et les obstacles mobiles |
| Colle | son prochain tir | résistance au roulement ×4, ne rebondit pas sur le sol |
| Aimant | son prochain tir | le trou l'attire (6 u/s²) à moins de 3,5 de lui |
| Boulet | les autres | leur prochain tir part à 60 % |
| Brouillard | les autres | leur écran est voilé jusqu'à leur prochain tir (un effet du client) |
| Échange | la balle la plus proche du trou | elle et la sienne changent de place (les deux au repos, la sienne plus loin) |

Un pouvoir pour soi s'arme (un seul à la fois, la flèche devient violette) ; un pouvoir contre les autres agit
tout de suite, refusé s'il n'a personne à viser (erreur `power`). Le tirage dépend de l'image, du joueur et
de la caisse : une piste rejouée tire les mêmes. Le client reçoit la main de chacun dans `room` (`powers`,
`armed`, `curse`) et trois événements : 15 un pouvoir joué, 16 un pouvoir reçu d'une caisse, 17 touché par
celui d'un autre (valeur : le pouvoir). Vérifié par un essai temporaire du moteur (super coup deux fois plus
loin, saut par-dessus un mur de 0,45, fantôme qui laisse l'autre balle en place, colle quatre fois plus
courte, aimant qui fait tomber une balle passée à 1,8 du trou, boulet, échange), puis en jeu dans Edge.

**Le pool de trous** : 35 trous, `maps/p01-*.json` à `maps/p37-*.json` et les six trous des deux mondes. Le 2026-11-27, les huit trous
les plus simples (un tir parfait du départ faisait le trou en un sur un par 3, ou le terrain ramenait seul la balle au trou) ont été
retirés (p02, p04, p11, p12, p16, p22, p23, p28 : ils sont dans l'historique git), et cinq trous durs ajoutés, p33 à p37 (voir « Les
trous durs » dans `docs/parcours-v2.md`). Les trous à thème festif, ferme,
galactique et de Noël, voir « Les trous festifs » dans `docs/parcours-v2.md`), conçus pour 3 à 9 joueurs qui
tirent en même temps (les balles se cognent). Leurs idées (le niveau, la vedette, la ligne sûre et la
ligne risquée, ce que le jeu à plusieurs y crée) et leurs mesures sont dans `docs/parcours-v2.md`, les
règles qui les guident dans `docs/recherche-parcours.md`. Les 75 trous d'avant (et
`docs/parcours-concepts.md`) ont été retirés le 2026-11-22 : ils sont dans l'historique git. Un JSON de
`maps/` n'est jamais écrit à la main : il sort de son script.

- `tools/maps/holes/pNN-nom.mjs` décrit un trou avec les aides de `tools/maps/lib.mjs` (`floor`,
  `slab` une pente, `rail` des murs, `fence`, `block`, `post`, `water` un bassin, `pad`/`disc`
  des zones, `tee`, `cup`), et ses pièces arrondies : `path` (chemin à murs, lignes droites qui montent
  ou descendent, virages plats), `plate` et `green` (plateaux `roundRect` ou `disc`, avec ouvertures),
  `bowl` (cuvette) ;
- avec `DEV_MAPS=1 go run .`, un trou reconstruit est joué à la partie suivante, sans relancer le
  serveur (un fichier ajouté ou retiré demande un redémarrage) ;
- `node tools/maps/build.mjs pNN` écrit `maps/pNN-nom.json` (sans argument : tous) ;
- `go run ./tools/mapcheck -file maps/pNN-nom.json -verify` dit ce que `tools/verify` pense de ce
  seul trou ; `-sweep` montre où finissent les tirs du départ (`-from x,y,z` : d'ailleurs), et
  `-shot degrés,puissance` suit un tir image par image ;
- enfin `go run ./tools/verify` sur tout le pool.

**Les thèmes.** Chaque trou porte un `theme` (`hole('Nom', { theme: 'quai', … })`), qui ne change que
son habillage : `bocage` (haies taillées, le défaut), `ville` (brique, ciel rose), `quai` (planches,
la mer sous le parcours), `canyon` (strates de roche), `chateau` (pierre, créneaux, brume),
`banquise` (rondins, crête de neige, mer sombre et glaçons), `nuit` (ciel étoilé, guirlandes
d'ampoules), et quatre thèmes de fête, chacun avec ses props faits dans `web/scene.js` (`craft`) :
`fete` (fête foraine : rayures de baraque, ampoules, grande roue qui tourne, chapiteau, sucettes,
confettis qui tombent), `ferme` (planches de grange, bottes de foin, tournesols, grange, la boue pour
le sable, des canards dans les mares), `galaxie` (espace : nébuleuse, néons, cristaux, astéroïdes,
planètes à anneaux, soucoupes volantes), `noel` (murs sucre d'orge, sapins décorés, cadeaux,
bonshommes de neige, neige poudreuse pour le sable, neige qui tombe ; pas en graphismes allégés), et les
thèmes des mondes : `volcan` (basalte veiné de lave, herbe de cendre, la lave dans les bassins et en mer sous
le parcours, la glace en obsidienne, des braises qui montent, le volcan qui fume au loin, des arbres morts) et
`pirate` (planches délavées, sable, palmiers, coffres au trésor pour caisses à pouvoir, une épave au large,
des mouettes). Ce qui joue garde ses couleurs partout. Le choix des couleurs, les contrôles de
lisibilité et le thème de chaque trou sont dans `docs/themes.md` ; le code dans `THEMES`, `SIDE`,
`CROWN` et `dress()` de `web/scene.js`. Le serveur refuse un thème inconnu.

Chaque trou est accepté par `tools/verify`, au mieux au par ou au par − 1 pour presque tous
(quelques lignes risquées vont plus bas). Rien n'a encore été joué à plusieurs : les réglages sont
des valeurs de départ.

Le client les dessine sans un mot ni une étiquette : ce que fait un sol ou une zone se voit à son
aspect (`LOOK`, `GROUND` et `zoneProps` dans `web/scene.js`, les modèles dans « Les modèles 3D ») :

| Quoi | Ce qu'on voit |
| --- | --- |
| `ice`, `sand` | glace bleu pâle à reflets doux et fines fissures ; sable à gros pois (boue brune à la ferme, neige poudreuse blanche à Noël) |
| `jelly` | gelée lilas, brillante, à bulles |
| `speedpad` | plaque orange à gros chevrons qui défilent dans le sens de la poussée, d'autant plus vite qu'elle pousse fort |
| `jumppad` | un plateau sur ressorts de la taille de la zone, qui rebondit sans cesse |
| `launcher` | un canon sur son affût, sa culasse au milieu de la zone, sa bouche dans le sens et à l'angle du tir ; après la bouche, l'arc en pointillés qui volent |
| `teleport` | spirale qui tourne dans une colonne de lumière, des paillettes qui y plongent, des éclats autour ; la sortie, la même en plus petit, qui tourne à l'envers, ses paillettes en sortent. Chaque téléporteur du trou a sa couleur, partagée avec sa sortie : violet, rose, indigo, puis de nouveau violet (`PORTALS`) |
| `hazard` | de l'eau vivante (`WATER`, un shader) : claire sur les rives et profonde au large, houle lente, reflets qui scintillent, écume qui lèche chaque rive (pas là où un autre bassin la continue) ; un aileron de requin dans un bassin moyen, deux dans un grand |
| `checkpoint` | bande à damier, un fanion à damier flottant à chaque bout |
| `strokes` | le jeton, qui flotte face à la caméra : pièce d'or marquée « -1 » ; au sol, un soleil doré (zone ronde) ou des pièces sur toute la zone (zone longue) |
| `key` | la clé, qui flotte et tourne, son ombre au sol, rien d'autre |
| `wind` | une rangée de ventilateurs au bord d'où il vient, à la hauteur de la zone, et des traits de vent qui la traversent ; une zone fine (0,3 de haut au plus) est un tapis roulant qui défile |
| `magnet` | plaque d'acier à anneaux rouges qui courent vers le centre (aimant) ou bleu marine qui en partent (répulseur) |
| `gravity` | un voile indigo étoilé, translucide et sans contour (au-dessus d'un vide, il ne doit pas passer pour un sol), des étoiles qui montent lentement dans toute sa hauteur |
| `vortex` | un disque d'accrétion orange et rose autour d'un cœur noir, qui tourne dans le sens où il fait tourner la balle |

L'herbe est tondue en larges bandes dans l'axe du trou, un peu inégale, plus claire en hauteur et plus sombre dans les creux ; une pente tournée vers le soleil s'éclaire, une pente à l'ombre s'assombrit : le relief se lit sans trait. Le soleil projette des ombres (murs, objets, balles). Chaque zone au sol est un autocollant cerné d'encre. Le jaune rayé d'encre est réservé à ce qui
bouge : les obstacles mobiles. Une porte prend la couleur de sa clé (`KEY_COLOR` : bleu, puis vermillon ; à partir de la
troisième, une clé partage sa couleur avec un autre élément : deux clés au plus par trou) et porte son cadenas. Quand une zone agit sur sa balle, le
joueur la voit nommée dans un bandeau ; une clé ou un bonus pris disparaît.

Le parcours n'est pas dessiné boîte par boîte (`floorMeshes`, `wallMeshes` dans `web/scene.js`) : les sols
fixes sont fusionnés par carrés de 8 u, sans les faces cachées entre deux sols ; les murs simples sont
suivis bout à bout et dessinés comme un seul mur (en onglet aux angles, lissé dans les courbes douces),
avec un contour et une couronne continus. Rien ne s'efface devant la caméra : les murs sont bas (choix
du 2026-11-22, l'effacement rendait aussi transparents le drapeau et les sols à plusieurs étages).
Mesuré sur La Passerelle (662 colliders) : 271 appels de dessin par image au lieu de 4 633.

Une zone est déjà un volume, pas une surface : le vent agit sur la balle dans toute sa hauteur (`h`
d'une boîte, `hh` d'un cylindre), en l'air comme au sol. Pour un vent qui souffle dans les airs, la
carte lui donne de la hauteur ; rien à changer dans le moteur.

**Ajouter un modificateur.** Côté serveur, une struct pour ses paramètres dans
`internal/physics/effects.go`, sa méthode `check` (les paramètres sont-ils valides), `enter`
(quelque chose arrive quand le centre de la balle entre) et/ou `field` (des forces tant qu'il y
est), et une ligne dans `init`. Ce qu'il fait ne peut dépendre que de la balle et de la zone, et
tout ce qu'il garde va dans un champ de `physics.Ball`. Rien à toucher dans `internal/game` ni dans
le protocole. Côté client, son nom dans `WORDS` (`web/scene.js`, le texte du bandeau) et son aspect : un sol dans `GROUND`, des props dans `zoneProps`.

**Ce que le client reçoit en plus** : les zones et les
mouvements dans `hole`, un saut dans le chemin d'une balle qui sort d'un téléporteur, et quatre
événements : 10 un bumper (valeur : le numéro du collider), 11 une zone a agi (valeur : le numéro
de la zone, le client sait son type), 12 un téléporteur (idem), 13 les coups du joueur changés par
une zone (valeur : ses coups). `maxStrokes` dans `room` est celui du trou.

Comment c'est fait (`internal/physics`) :

- **entrer dans une zone coupe le pas** à l'instant où le centre la franchit (dichotomie, comme un
  rebond), pour que deux tirs voisins passent un pad à des instants voisins et finissent côte à
  côte ; une zone où un rebond fait entrer la balle au milieu du pas agit à la fin de ce pas ; le
  reste du pas cherche la zone suivante, si bien que deux zones qui se touchent, ou la
  sortie d'un téléporteur dans une zone, agissent toutes les deux ; une balle qu'une zone a
  accélérée finit son image en pas plus courts (0,1 au plus), pour ne pas traverser une zone fine
  sans la voir ;
- **les forces sont constantes sur un pas** (gravité, poussées, frottement) : le vol et le
  roulement restent exacts ; un pas qui entre ou sort d'une zone de force est rejoué en pas plus
  fins, comme un changement d'appui ;
- **un collider qui bouge** est placé à l'instant voulu ; les chocs se calculent avec la vitesse de
  sa surface, et une balle posée dessus est emportée. Une balle emportée ne se met jamais au
  repos : au bout de 30 s, elle est traitée comme coincée (+1 coup) ;
- **une balle prise entre un obstacle mobile et un bord fixe** (un mur, un poteau) est poussée de
  côté, à l'endroit libre le plus proche le long du bord, à sa hauteur (par-dessus seulement s'il
  n'y en a pas) : sinon l'obstacle la ferait passer à travers ;
- **un obstacle mobile pousse une balle au repos** : une balle qui s'arrête retient la première
  image où un collider mobile peut l'atteindre (`Ball.WakeAt`, cherché sur une période). Le
  serveur la rejoue à cette image, et prévient les clients une seconde avant, comme pour une balle
  qui roule ;
- **un téléporteur** : la recherche des balles proches regarde aussi autour des sorties, et une
  balle qui a sauté pendant une image est jugée morceau par morceau pour les rencontres.

Vérifié (tests temporaires, archivés dans `../trou-normand-prototype/lean-tests/modifiers/`) :

- sur les pistes de test, **chaque octet envoyé aux joueurs est identique** à avant les
  modificateurs (300 parties scriptées, 12 966 tirs, empreinte de tous les messages) ;
- sur la carte de démonstration, **le recalcul partiel est exact** : 120 parties de 2 à 10 joueurs
  (tirs, arrivées, départs), après chaque action toutes les balles rejouées à chaque image et
  comparées bit à bit aux pistes gardées, 32 millions de positions, dont 4 470 balles au repos
  poussées par un obstacle. L'essai échoue si l'on retire la prévision des réveils, les sorties de
  téléporteur dans la recherche des balles proches, les morceaux d'une balle téléportée, ou si le
  cache des liens périmés n'est pas vidé quand une piste repart ;
- **chaque modificateur fait ce qu'il dit**, 25 scénarios sur la carte de démonstration ; et 9
  cartes fausses refusées avec le bon message ;
- détecteur de courses, 600 bots en salles de 10 sur la carte : aucune course.

Ce que ça coûte, en alternant les binaires (2 000 bots, salles de 10, un tir par seconde) : sur
les pistes de test, sans aucun modificateur, **+12 % de CPU utilisateur, +8,5 % au total** et
+7 Mo (le moteur vérifie portes, mouvements et zones, et une balle pèse 180 octets au lieu de
104) ; la physique seule, +13 %. Sur la carte de démonstration, 55 % d'un cœur contre 27 % : les
balles y roulent bien plus longtemps (glace, vent, aimant, obstacles qui relancent les balles).

Limites :

- une zone `hazard` a toujours l'air d'eau (la carte ne dit pas si c'est de l'eau, de la lave ou
  du vide) ;
- un seul trou à viser par carte (pas de raccourci vers un second trou) ; les zones ne bougent
  pas (pas de ventilateur intermittent) ;
- un bumper renvoie toujours la balle à 9 u/s : face à un autre mur à quelques unités, il la
  relance sans fin, jusqu'à ce que le filet de sécurité l'arrête au bout de 30 s. Une carte
  laisse donc de la place devant ses bumpers ;
- une zone ne voit que le centre de la balle, au bout de chaque pas : plus fine que 0,2, elle
  pourrait être traversée sans être vue (d'où le refus) ;
- une balle morte sur un `jumppad` y rebondit jusqu'au filet de 30 s, et quelques trajectoires
  rares entre deux bumpers aussi (`tools/verify` le signale quand il le croise) ;
- les coups ne descendent pas sous 0 ;
- le ressenti n'a été jugé par personne : les réglages de `material.go` et des trous sont des
  valeurs de départ.

## Le client

Deux moitiés d'inégale avancée : **l'avant-partie est soignée** (accueil, salles, salon),
**la partie elle-même reste une base minimale**. 2 380 lignes (1 950 de JavaScript, 110 de page,
320 de style) sans étape de construction, des modules ES servis tels quels, et Three.js (r170)
copié dans `web/vendor/`. Il ne connaît aucune règle et aucune taille : il montre ce que le
serveur envoie.

**Ordinateur seulement.** Un appareil dont le pointeur principal est un doigt (téléphone,
tablette, `pointer: coarse`) reçoit un écran « Le jeu se joue sur ordinateur » avec le lien à
ouvrir ailleurs, et le jeu n'est même pas chargé (`web/index.html`). Un portable à écran tactile
passe : son pointeur principal reste le pavé tactile.

**Toutes les tailles d'écran d'ordinateur.** Les menus, l'accueil, le salon, la fin de partie et
les cartouches de la partie sont dessinés pour une fenêtre de 1160 × 780 et agrandis ou réduits
d'un bloc à la fenêtre réelle (`zoom: var(--ui)`, calculé par `web/main.js`, de 0,7 à 1,6) :
ils tiennent sans défiler de 1024 × 640 à 2560 × 1440, le salon avec ses 16 places. Un bouton
dont le texte change (« Copier le lien ») garde sa largeur : ses deux textes sont là, un seul se
voit (`.swap`).

**Français et anglais.** Tout texte que lit un joueur est dans `web/i18n.js`, une seule table
`clé: [français, anglais]` : un texte nouveau s'y ajoute dans les deux langues, jamais en dur dans
le code ni dans la page (`data-t`, `data-t-label`, `data-t-placeholder` pour ce que tient
`index.html`). La langue : celle choisie en haut à droite de l'accueil (gardée par le navigateur,
`tn-lang`), sinon la première langue française ou anglaise du navigateur, sinon l'anglais. Le
serveur n'envoie que des codes (`notfound`, `kicked`…) que le client dit. Les noms des trous
viennent des cartes et ne sont pas traduits.

```
web/index.html   la page : l'accueil, le salon, et les cartouches de la partie
web/style.css    l'habillage : tout ce qui est couleur, forme et mise en page
web/front.js     l'avant-partie : le joueur, les salles à ouvrir ou à rejoindre, le salon, la fin d'une partie
web/hud.js       la partie : menu, classement, coups, compte à rebours, réglages du joueur
web/ui.js        les petites briques communes aux menus de front.js et hud.js (bouton, fenêtre, question),
                 et leurs fenêtres : un panneau et une question par-dessus, redessinés sans bouger la page
web/i18n.js      les textes, en français et en anglais, et le choix de la langue
web/previews/    les aperçus des trous, faits par tools/previews (pas dans le dépôt : l'image les redessine)
web/main.js      le câblage : quel écran montrer, gestes du joueur (visée, caméra), boucle
web/net.js       ce que dit le serveur : connexion, salles, trou, et où est chaque balle à tout instant
web/scene.js     le dessin : le trou construit depuis ses colliders et ses zones, ses props et son décor, les balles, la flèche
web/models/      kit.glb : les props modélisés dans Blender (voir « Les modèles 3D »)
web/audio.js     les sons, synthétisés (aucun fichier audio)
web/vendor/      Three.js (avec son GLTFLoader), et les deux polices, avec leurs licences (MIT, OFL)
```

**Les aperçus des trous** ne sont pas dessinés par le navigateur : `go run ./tools/previews` les
dessine, avec la scène du jeu (`web/scene.js`) dans Chrome headless, en WebP 400 × 280 (~9,5 ko
chacun), dans `web/previews/` qui part dans le binaire. La construction de l'image les redessine
tous à chaque fois (75 trous : ~17 s) : ils sont toujours ceux des cartes construites, et ne sont pas
gardés dans le dépôt (`.gitignore`). Pour les voir sur un serveur de développement, lancer
`go run ./tools/previews` avant ; sans eux, le serveur le signale au démarrage (« N holes have no
picture ») et sert les trous sans image. Une image porte le nom d'un condensé du trou et du code qui
dessine (`web/scene.js`, Three.js et son GLTFLoader, `web/models/kit.glb`, `tools/previews/render.*`) : le serveur les sert avec un cache
permanent (`immutable` : une image nouvelle a un nom nouveau) et donne leurs adresses dans
`welcome` ; le navigateur ne charge que celles qui sont à l'écran, puis les garde. Chrome est cherché
dans le PATH (ou `CHROME=/chemin`) ; l'image le construit avec le Chromium de Debian, qui dessine le
WebGL sans carte graphique (celui d'Alpine ne le fait pas).

### Les modèles 3D

**Depuis le 2026-11-25, le rendu est réaliste** : ce qui suit sur le style autocollant décrit l'origine des
modèles, plus ce qu'on voit. Toutes les surfaces sont des matériaux physiques (`MeshStandardMaterial`,
tone mapping neutre, le ciel en lumière d'environnement) ; les contours d'encre ne sont plus dessinés (leurs
maillages restent, invisibles) ; les murs et les matières naturelles ont des textures en relief faites dans
le navigateur (feuillage, brique, pierre, planches, rondins, roche, terre, gazon des îlots) ; le gazon a des
brins (`turf`), des zones sèches et une ombre de contact au pied des murs, calculée une fois par trou
(`bakeContact`) ; arbres, buissons, rochers sont refaits en code (`the decor, realistic` dans
`web/scene.js`), les nuages sont des volutes douces dessinées en un appel (`cloudPuffs`), la mer des thèmes
`quai`, `volcan` et `pirate` est animée (`SEA`), les balles sont des balles de golf laquées à alvéoles.
Mesuré sur 10 trous (Chrome sans carte graphique) : 30 % d'appels de dessin en moins et deux à trois fois moins
de triangles qu'avant ; chaque pixel coûte un peu plus (la lumière physique), d'où l'option « graphismes
allégés » qui reste.

Le style : **des autocollants en relief qui flottent dans le ciel**, le prolongement en 3D des
menus. Ombrage toon en trois tons (`MeshToonMaterial`, une rampe plus douce pour le crème et le
blanc), traits d'encre (`#17332b`) autour de ce qui se dresse sur le parcours, des props et des
balles, gazon tondu en bandes croisées, murs crème aux flancs sable, poteaux crème cerclés de rouge,
noms des joueurs en autocollants crème, aucune autre étiquette. Chaque parcours est un jardin suspendu : sous chaque sol, du gazon
qui pend en festons, une bande de terre, de la roche sous une ligne ondulée, jusqu'à une mer de
nuages (là où une balle est perdue) ; autour, des îlots. Seul ce qui agit sur la balle est saturé.
Toutes les couleurs sont dans `PALETTE` (`web/scene.js`).

Les props sont faits par un script, sans retouche à la main : `tools/models/kit.py` les construit
dans Blender et les exporte tous dans `web/models/kit.glb` (un seul fichier, chargé avant le premier
écran) ; il enregistre aussi `tools/models/kit.blend` pour les regarder dans Blender. Après un
changement du script :

```sh
blender -b --factory-startup -P tools/models/kit.py   # puis go run ./tools/previews
```

Chaque face porte un matériau nommé d'après une clé de `PALETTE` (`tint` : la couleur que le jeu
donne, celle d'une clé, d'une fleur, d'une montgolfière). Chaque prop est modélisé à la taille où le
jeu le montre. Le trait d'encre n'est pas dans le fichier : chaque objet en donne l'épaisseur
(propriété `ink`) et le jeu le construit au chargement (`inkShell`), une coque poussée le long
des normales, vue de l'intérieur ; le fichier en est deux fois plus léger. Un prop ne dépasse
jamais ce qu'il habille et n'a pas de collider : ce qui n'est pas plat flotte au-dessus de la balle.

| Prop | Où | Triangles |
| --- | --- | --- |
| `flag`, `cup_rim`, `tee` | le drapeau (mât à bandes rouges, fanion qui ondule), le bord du trou, le tapis de caoutchouc du départ | 636, 288, 552 |
| `bumper_cap` | le chapeau d'un poteau `bumper` | 1 296 |
| `bonus` | pièce d'or « -1 », sur une zone `strokes` | 1 500 |
| `malus` | étoile rouge à piques « +1 » : plus utilisée (le malus a été retiré) | 1 180 |
| `key`, `padlock` | la clé d'une zone `key`, le cadenas sur sa porte, à sa couleur | 780, 680 |
| `ghost`, `weight`, `gum`, `spring` | plus utilisés (les pouvoirs ont été retirés) | 646, 1 132, 948, 1 648 |
| `portal`, `shard` | la spirale d'un téléporteur (et de sa sortie), les éclats qui tournent | 1 116, 24 |
| `fan` | là d'où vient un vent (pas sur une zone fine : un tapis roulant) | 2 478 |
| `cannon`, `cannon_carriage`, `coil`, `fin`, `pennant` | le canon (fût creux et affût), les ressorts d'un plateau de saut, l'aileron de requin, les fanions à damier d'un checkpoint | 672, 344, 584, 136, 176 |
| `islet_s`, `islet_m`, `islet_l` | les îlots (le grand avec sa mare et sa cascade) | 292, 292, 382 |
| `tree_ball`, `tree_pine`, `tree_blossom`, `bush`, `rock_a/b/c`, `flower`, `mushroom`, `fence` | ce qui pousse sur les îlots | 1 032, 476, 1 356, 400, 80, 400, 522, 338 |
| `cloud_a/b/c`, `balloon`, `windmill` | la mer de nuages, deux montgolfières, le moulin au loin | 480, 556, 682 |

25 179 triangles en tout (sans les traits d'encre, qui les doublent à peu près, nuages compris), 724 ko (233 ko
compressés en gzip). Les chiffres des jetons sont en Liberation Sans Bold si la machine l'a
(`/usr/share/fonts/liberation/`), sinon dans la police de Blender. Le décor est placé d'après le trou seul (le même trou, la même vue) et hors du
groupe du parcours, que les caméras cadrent : à 3–7 du parcours, des petits îlots (buissons, rochers,
fleurs, champignons) ; à 8–20, des îlots avec arbres, barrière et cascade, tirés depuis le bord d'un sol (aussi le long
des grands côtés), entre la mer de nuages et la ligne du regard ; à 45–70, le moulin et
les montgolfières. Rien ne passe entre la caméra et une balle : à une distance d du parcours, rien ne
dépasse 0,12 × d au-dessus de son sol le plus bas (le regard le plus rasant de la caméra), et ce qui
est plus haut est plus loin que la caméra ne va. Le décor est fait d'`InstancedMesh` : un appel de
dessin par morceau de modèle, quel que soit leur nombre. Sur les 14 trous, une image coûte de 113 à
239 appels de dessin et de 169 000 à 223 000 triangles (dont les nuages et leur trait pour plus de la moitié ; `renderer.info`
dans Chrome sans écran, vue d'ensemble ; rien n'a été mesuré en images par seconde).

### Avant la partie

Trois écrans, sur la même page (`web/front.js`) :

- **l'accueil** : son pseudo et la couleur de sa balle, « Créer une salle » (le salon s'ouvre
  aussitôt, privé, avec les derniers réglages de ce navigateur), en rejoindre une par son code
  ou par la liste des salles publiques ;
- **le salon** : le nom (modifiable par le propriétaire), le code, le lien à copier ; à gauche
  « Ton joueur » (la même carte qu'à l'accueil, couleurs sur deux rangs) puis les joueurs sur deux
  colonnes jusqu'en bas, places libres en pointillés (16 tiennent sans défiler ; le propriétaire
  exclut au survol) ;
  « La partie » : les réglages, en contrôles pour le propriétaire et en valeurs pour les autres,
  le parcours (« Choisir parmi quels trous » ou « Composer le parcours », chaque trou montré en 3D
  sans perspective, tourné pour remplir l'image, départ à gauche et trou à droite ; la case à cocher
  ou le « + » sous l'image, à côté du nom), « Lancer la partie »
  ou « En attente de … ». Toute confirmation s'ouvre dans sa propre fenêtre ;
- **la fin d'une partie** : un podium animé (les marches montent, les trois premiers tombent
  dessus, confettis), « Voir le classement » (le tableau trou par trou), « Retour au salon ».
  Chacun à son rythme ; si le propriétaire relance entre-temps, tout le monde est ramené dans
  la partie.

Comment c'est fait :

- **l'adresse porte la salle** (`/#K3F9P`) : c'est le lien d'invitation. L'ouvrir fait entrer
  dans la salle, même collé dans un onglet déjà ouvert sur le jeu ; quitter la salle vide
  l'adresse ;
- **le joueur est un onglet, le profil est un navigateur** : le jeton de session est gardé par
  onglet (deux onglets font deux joueurs, un rechargement rend sa place), le pseudo et la
  couleur par navigateur, et redits au serveur à chaque connexion ;
- **la liste est demandée, pas poussée** : toutes les 3 s tant que l'accueil est affiché et
  l'onglet visible. La page n'est retouchée que si la liste a changé ;
- **une coupure ne change pas d'écran** : la page reste telle quelle avec « Connexion… », sans
  qu'on puisse y cliquer, puis
  reprend sa place ou, si la salle n'existe plus, revient à l'accueil en le disant. Les
  tentatives s'espacent (0,5–1 s, puis 1–2 s… jusqu'à 15–30 s) ;
- **l'identité visuelle** : des autocollants sur une pelouse tondue. Trait épais, aplats,
  ombres dures, cartes crème sur fond vert rayé. Le titre est en DynaPuff, tout le reste en
  Nunito pour la lisibilité (les deux sous licence OFL, servies par le jeu : aucune requête
  vers un autre site). Ordinateur seulement, 1280 × 800 de référence.

Vérifié dans Chrome sans écran, deux onglets et des joueurs simulés, 25 contrôles sans erreur
JavaScript : arrivée, création d'une salle privée (absente de la liste), entrée par le lien, par
le code tapé en minuscules, par un lien collé dans l'onglet ouvert ; couleur déjà
prise, changement de pseudo et de couleur vu par les autres, nom affiché comme du texte
(`<img …>` reste du texte) ; un invité ne peut pas lancer ; rechargement ; départ du propriétaire
et passage de la salle ; coupure au salon puis en partie, et retour à sa place ; même joueur
dans un second onglet ; serveur relancé (salle disparue). Le script qui prend les captures
contrôle en plus la liste (ordre, salle en jeu, salle complète), l'entrée par la liste, un code
inconnu et une partie jouée jusqu'au tableau des scores. Côté serveur, 17 contrôles du
protocole sur un binaire compilé avec le détecteur de courses. Le rendu a été jugé sur des
captures d'écran, en 1280 × 800 et en 390 × 844.

Limites de l'avant-partie :

- deux onglets du même navigateur partagent le pseudo et la couleur préférée (le second prend
  une autre couleur en entrant dans la même salle) ;
- le choix de la couleur se fait à la souris, au doigt ou à la tabulation, pas aux flèches du
  clavier ; aucun lecteur d'écran n'a été essayé ;
- jugé par aucun joueur ; sur téléphone, seule la mise en page a été contrôlée (dans Chrome en
  largeur de téléphone), pas un vrai appareil.

### Pendant la partie

Ce que fait la base : viser (glisser en arrière donne la ligne et la force, la flèche oscille
autour de cette ligne, le tir part où elle pointe au relâchement ; seule la flèche guide, sans
texte : un anneau autour de la balle dès l'appui (gris tant que relâcher annulerait), la flèche
cernée d'encre, jaune pour un petit coup et rouge à pleine force. Tout est posé sur le sol : plat sur le plat, plié là où une pente commence, à niveau
au-dessus d'un vide ou d'une marche trop raide ; la partie de la flèche cachée par un mur ou un
obstacle reste visible en transparence), tourner et zoomer la caméra
(souris : clic droit glissé et molette ; pavé tactile : glisser à deux doigts pour tourner, pincer
pour zoomer, clic droit ou ctrl+clic glissé pour tourner), jouer un son par événement, reprendre sa place après un rechargement ou une coupure.

L'écran de jeu (`web/hud.js`) laisse le haut au
centre libre, là où pointe la flèche et où est le trou : menu en haut à gauche, classement compact
en haut à droite (le premier, celui juste devant, soi), coups et compte à rebours en bas au centre
(on vise à travers). Le nom du trou s'affiche 2,5 s à son début dans un bandeau en haut (moins si l'on tire avant), sans
aide pour viser. Une balle dans le trou perd son nom et disparaît une fois immobile, pour ne pas
gêner la visée des autres.
Le menu (☰ ou Échap) s'ouvre au centre : reprendre, réglages (volume, sensibilité de la caméra,
noms au-dessus des balles, plein écran, gardés par le navigateur), inviter, abandonner le trou,
quitter, arrêter la partie (propriétaire). Toute confirmation s'ouvre dans sa propre fenêtre, rien
ne bouge dessous. Tab maintenu montre le classement complet trou par trou, sans voile sombre derrière (rien ne
clignote si on l'appuie souvent) ; les menus apparaissent sans animation ; un clic sur le
classement compact le garde ouvert, et le propriétaire y exclut un joueur. Aucun raccourci n'est
écrit à l'écran.

`net.js` ne dépend ni de la page ni de Three.js (il tourne tel quel dans Node). C'est lui qui
rejoue les trajectoires, avec quatre règles en plus de celles du protocole :

- **l'horloge ne saute jamais pendant qu'une balle roule** : quand tout est arrêté, elle n'est
  recalée d'un coup que sur un paquet qui s'en écarte de plus de 15 images (250 ms), en avance ou
  en retard : un tir très en retard est ainsi joué depuis son début, au pas des obstacles. Plus
  près, le bruit d'une image ou deux ne fait aucun à-coup ; sinon, elle tourne un peu plus vite (15 %) ou un peu plus lentement (10 %) pour suivre ce que
  disent les paquets ;
- **le trou est montré avec un retard qui suit la gigue** : jamais en avance sur le serveur, et
  aussi tard que le paquet le plus lent des dernières secondes est arrivé par rapport au plus
  rapide (150 ms au plus, oublié en une demi-minute de réseau régulier). Une trajectoire arrive
  ainsi avant d'être à l'écran : pas de balle figée puis pressée, pas de balle replacée d'un coup ;
- **une balle qui démarre en retard rattrape au lieu de sauter** : quand la trajectoire reçue
  est déjà partie, la balle qui attendait à son point de départ la prend depuis ce point, 15 %
  plus vite, jusqu'à être à l'heure (50 ms rattrapés en un tiers de seconde). Elle reste
  toujours sur sa vraie trajectoire ; ses sons sont joués à son heure à elle ;
- **le son de son propre tir part au relâchement**, sans attendre le serveur ; la balle, elle,
  part quand le serveur répond.

Vérifié de deux façons. D'abord `net.js` lui-même, lancé dans Node contre un serveur instrumenté
(détecteur de courses actif) : des bots jouent, et chaque position **affichée** à chaque image
est comparée à ce que le jeu a réellement fait à cet instant de la balle. La gigue simule un
réseau irrégulier (15 à 27 ms par message, 8 % des messages retardés de 30 à 110 ms de plus).

| Essai | Positions affichées comparées | Écarts | Événements mal joués, sur ceux joués par les clients |
| --- | --- | --- | --- |
| 4 joueurs + 1 arrivée en cours, 60 s, sans gigue | 203 727 | 0 | 0 sur 1 212 |
| idem avec gigue | 202 498 | 0 | 10 sur 1 096, tous en fin de trou (voir limites) |
| piste sans murs, avec gigue (173 replacements après sortie affichés) | 199 267 | 0 | 3 sur 804 |
| 8 joueurs + 1 arrivée, 45 s, avec gigue | 537 505 | 0 | 16 sur 2 888 |

Le même test avec la règle « un segment qui prolonge » retirée échoue (178 écarts et 64 sauts
en 30 s sans gigue, jusqu'à 22 cm) : il détecte bien ce qu'il doit détecter. Les trois essais
avec gigue ont été repassés sur le serveur et le client d'après l'avant-partie : 0 écart sur
199 367, 532 536 et 115 251 positions, et le test sans la règle échoue toujours (223 écarts). Ensuite la page entière, pilotée
dans Chrome sans écran avec de vrais gestes de souris : tir visé, annulation, coup compté,
caméra, balle de la couleur choisie, sans erreur JavaScript, et une partie jouée jusqu'au tableau
des scores. Le trou réussi à la souris et le tour de 6 des 7 pistes datent de la version d'avant
les écrans d'avant-partie et n'ont pas été repassés depuis.

Limites connues de la partie :

- **quand un tir change la trajectoire d'une balle qui roule déjà, dans la fenêtre de retard**,
  cette balle fait un saut (5 à 13 cm sans gigue ; avec, 46 cm au pire d'abord, puis 98 cm
  sur un essai plus récent : c'est la vitesse de la balle fois le retard). Cas typique : deux
  joueurs qui tirent dans la même image depuis le même départ, leurs balles se percutent
  aussitôt. Le saut tombe au moment du choc ;
- dans la même fenêtre, un son peut être joué avec la force d'avant le changement (les
  événements « en trop ou en moins » du tableau) ;
- **le trou suivant démarre à l'instant où le dernier joueur a fini** : s'il finit faute de
  coups, son dernier message et son dernier son sont coupés. Il manque une pause de fin de trou
  côté serveur ;
- au départ, les balles pas encore tirées sont translucides et superposées : la sienne ne se
  distingue pas des autres ;
- pensé pour la souris : le tactile n'a pas été essayé et n'a pas de geste pour la caméra ; pas
  de réglage du volume ;
- Three.js fait 690 ko (et les modèles 724 ko, chargés avant l'accueil) et part sans compression (à faire faire au reverse proxy). Le navigateur
  le garde ensuite tant que le serveur n'est pas relancé ;
- jugé par aucun joueur, sur aucun vrai réseau, dans aucun autre navigateur que Chrome.

## Le serveur : où part le temps

Un verrou par salle, quelques goroutines (« shards ») qui réveillent les salles sur un battement
commun à 60 Hz, des trames WebSocket encodées une fois et écrites directement sur le socket sans
bloquer. Une salle n'est réveillée que quand elle a quelque chose à faire (voir « Les
trajectoires envoyées d'avance »), une fois par seconde au moins.

Une seule simulation (une piste par balle, voir « Les trajectoires envoyées d'avance ») contre
l'architecture précédente (un jeu réel à 60 images par seconde à côté de la prévision, et un tir
qui recalculait toutes les balles), puis avec la balle entière gardée seulement toutes les
32 images (pistes compactes, voir « Comment c'est fait »). Mesuré en alternant les trois binaires
dans la même session, 2 000 bots, 20 s par passe, CPU lu dans `/proc`
(utilisateur + noyau, en % d'un cœur), deux passes par ligne sauf la troisième :

| 2 000 bots | Avant | Balle entière à chaque image | Pistes compactes |
| --- | --- | --- | --- |
| 500 salles de 4, un tir toutes les 2,5 s | 21,7 % · 62–65 Mo | 15,5 % · 138–140 Mo | **14,4 %** (−34 %) · **88–91 Mo** |
| 200 salles de 10, même rythme | 27,6 % · 64–68 Mo | 19,8 % · 137–144 Mo | **20,0 %** (−28 %) · **88–91 Mo** |
| 500 salles de 4, un tir par seconde | 29,6 % · 66 Mo | 21,7 % · 137 Mo | **21,6 %** (−27 %) · **93 Mo** |

Personne ne tire (500 salles en partie) : 2,3 % avant, 2,0 % après, mesuré avant les pistes
compactes. Messages et octets par joueur inchangés (2,1 msg/s et 1,6 ko/s ; 4,7 msg/s et
6,0–6,7 ko/s dans les salles de 10).

La mémoire, lue avec le profileur après un passage du ramasse-miettes, à 1 000 puis 2 000 bots
(500 salles de 4) : les données vivantes passent de 24 puis 47 Mo à **13 puis 24 Mo**, soit
11 ko par joueur au lieu de 23 ; les pistes, de 43 à 8,7 Mo à 2 000 bots. Le reste de la
mémoire du processus est la marge du ramasse-miettes (réglages Go par défaut). Une piste garde
la place de son plus long roulé au lieu d'être refaite à chaque tir : aucun déchet à chaque
tir, et une place bornée par balle (au plus 20 s de prévision).

Ces chiffres ne se comparent pas à ceux qui suivent, mesurés à une autre date sur la même machine
(le CPU de cette machine varie d'une session à l'autre : seule une comparaison alternée dans la
même session compte).

Le coût du serveur suit le **nombre de messages**, pas leur taille : chaque message est un appel
système `write` et un paquet. Mesuré sur le serveur qui envoyait les positions 30 fois par
seconde : 3,8 fois plus d'octets coûtaient 5 % de CPU en plus, 43 % de messages en moins en
coûtaient 28 % de moins. Compresser ne sert donc à rien ; c'est ce qui a mené aux trajectoires
envoyées d'avance.

Avant (positions 30 fois par seconde) et après (trajectoires), mesurés à la suite en alternant
les deux binaires, 2 000 bots sur la même machine, CPU lu dans `/proc`
(utilisateur + noyau, en % d'un cœur, arrondis) :

| 2 000 bots | Avant | Après |
| --- | --- | --- |
| 500 salles de 4, un tir toutes les 2,5 s | 116 % (35 + 81) · 29 msg/s et 2,0 ko/s par joueur · 48–51 Mo | **64 %** (47 + 17) · 2,2 msg/s et 1,5 ko/s · 67–69 Mo |
| 200 salles de 10, même rythme | 107 % (31 + 76) · 32 msg/s et 5,2 ko/s · 46–49 Mo | **81 %** (60 + 22) · 4,5 msg/s et 5,6 ko/s · 65–66 Mo |
| 500 salles de 4, un tir par seconde | 143 % (49 + 94) · 31 msg/s | **104 %** (73 + 31) · 3,2 msg/s |
| 500 salles en partie, personne ne tire | 4 % | 5 % |

Les deux premières lignes sont la moyenne de deux passes (écart inférieur à 1,5 point), les deux
dernières une seule passe. Soit −44 % dans le scénario de référence et −24 % dans le pire cas
pour les trajectoires (salles pleines : chaque tir fait recalculer jusqu'à 10 balles). La
mémoire monte d'environ 18 Mo pour 2 000 joueurs : le serveur garde la trajectoire annoncée de
chaque balle.

Le profil a changé de nature. Sur le premier scénario, après : **≈ 48 % dans la physique**
(≈ 28 % pour les prévisions, ≈ 20 % pour le jeu réel), ≈ 21 % dans `write`, ≈ 10 % dans
l'ordonnanceur Go. Avant, `write` prenait les deux tiers. Le levier suivant, s'il en faut un, est
donc de ne plus simuler deux fois : estimé alors à −18 % dans ce scénario. C'est fait depuis
(une seule piste par balle, et un tir ne recalcule que les balles qui peuvent changer) : −34 %
mesuré, voir le tableau en tête de section. Essayé et non gardé : envoyer les deux trames d'un tir (trajectoires et `room`) en
une seule écriture, −1,6 % de CPU pour +4 Mo.

Ce que le profilage avait permis de corriger auparavant :

- **mémoire par connexion divisée par deux** : la boucle de lecture tournait dans le handler
  HTTP, ce qui gardait en vie la requête et deux tampons de 4 ko par connexion. Mesuré sur
  4 000 connexions inactives : +82 Mo avant, +42 Mo après (environ 3,6 ko réellement vivants
  par connexion, le reste est du tas pas encore rendu au système) ;
- **écriture directe sans allocation** : elle allouait une fermeture par message (37 % des
  octets alloués). La trame des trajectoires et le brouillon des prévisions sont, eux, réutilisés
  d'un tir à l'autre.

À lire avec prudence :

- en local, le noyau fait aussi le travail de réception des bots pendant l'appel `write` : la
  part « noyau » est surestimée par rapport à un vrai réseau, et comme le gain vient presque
  entièrement de cette part, il sera probablement plus faible que −44 % en production ;
- les valeurs absolues bougent d'un facteur 4 selon l'état du portable (i9-13900H) : le scénario
  de référence, serveur « avant », a donné 31 % un jour et 116 % le jour des mesures ci-dessus,
  prises sur batterie en mode économie. Seules les comparaisons faites à la suite, en alternant
  les deux versions, sont fiables ; c'est ainsi qu'ont été obtenus tous les avant/après ;
- rien n'a été mesuré sur un vrai réseau, ni avec de vrais joueurs.

## Le moteur physique

Une balle ponctuelle (pas d'effet), des boîtes orientées, des cylindres verticaux et un trou
analytique. Le rôle du moteur : être juste et prévisible, avec un toucher arcade. Les constantes
qui font ce toucher sont toutes en tête de `internal/physics/world.go`, et elles n'ont **pas**
changé par rapport au prototype (gravité 18, tir à 16 u/s, résistance au roulement 2,2 + 0,2·v,
rebond 0,3 au sol et ≈ 0,7 sur les côtés, etc.).

Ce qui a été réécrit, c'est la façon d'avancer dans le temps. L'ancien moteur faisait 300 petits
pas par seconde et corrigeait après coup : un rebond se produisait là où le pas tombait, jusqu'à
5 cm trop loin, et deux tirs presque identiques n'arrivaient pas côte à côte. Le nouveau :

- **vol et roulement exacts** : trajectoire parabolique et résistance au roulement en formule
  fermée. Sur le plat, la balle s'arrête à l'endroit et à l'instant que donne la formule, quel
  que soit le pas ;
- **rebonds à l'instant de l'impact** : quand une balle a traversé une surface sur laquelle elle
  rebondit, le pas est coupé au moment du contact (recherche par dichotomie le long de la vraie
  trajectoire), le rebond se fait là, avec la vitesse que la balle a à cet instant ;
- **changements d'appui affinés** : un pas pendant lequel la balle atterrit, décolle, passe une
  arête ou un pli est rejoué en pas plus fins (jusqu'à 1/64) ;
- **arrêt net** : une balle stoppée par le frottement là où la pente ne peut pas la relancer est
  au repos tout de suite, au lieu d'attendre 0,25 s sous un seuil de vitesse ;
- **pas adaptatif** : 60 images par seconde, découpées seulement quand une balle va vite
  (10 cm au plus par pas), au lieu de 300 pas fixes.

Mesuré avec le banc de mesure (aujourd'hui archivé, `metrics_test.go`), en comparant chaque
moteur à lui-même avec des pas 32 fois plus fins (sa « vérité ») :

| | Ancien moteur | Nouveau |
| --- | --- | --- |
| tir avec un rebond : écart à la vérité (max) | 11 mm | 0,02 mm |
| deux tirs voisins (force +0,05 %) : saut du point d'arrivée (max) | 6,4 mm | 0,04 mm |
| distance d'arrêt sur le plat : erreur (max) | 16 mm | 0 |
| repos déclaré après l'arrêt réel | 0,2 s | dans l'image |
| trou, balle centrée : vitesses où entrer ou non dépend du hasard du pas | 8 sur 109 | 0 |
| tirs à moins de 1 cm de la vérité, sur 72 : lane / bank / posts | 54 / 57 / 46 | 71 / 71 / 72 |
| idem : ramp / hump / bowl / drop | 44 / 39 / 44 / 41 | 68 / 66 / 61 / 64 |
| coût d'une seconde de balle simulée | 40 µs | 11 µs |

Et le toucher est le même : à pas très fins, les deux moteurs donnent les mêmes points d'arrivée
(écart médian 0,01 cm sur 864 tirs, mêmes balles dans le trou). L'ancien moteur visait donc déjà
ces trajectoires, il les manquait de ≈ 1 cm de façon irrégulière ; le nouveau les atteint.

Côté serveur, à 2 000 bots, la part « notre code » avait baissé d'environ un quart (11–13 % →
8,5–10 % d'un cœur) quand le serveur envoyait encore les positions 30 fois par seconde. Depuis
les trajectoires envoyées d'avance, le moteur est le premier poste du serveur (voir plus haut).

Le monde n'avance que par images entières (1/60 s), et chaque balle avance seule
(`World.Advance`, avec ses propres sous-pas) : ce que devient une balle ne dépend que d'elle, du
trou et des balles qu'elle touche (`Meet`, `Collide`). C'est ce qui permet au serveur de rejouer
une balle sans rejouer les autres.

### Tests archivés

Les tests ont été retirés du dépôt et copiés dans `../trou-normand-prototype/lean-tests/`
(6 fichiers, 1 020 lignes). Ils tenaient ces garanties : arrêt comparé à la formule (à 10⁻⁹
près), rebond comparé à la formule depuis 50 points de départ (à 0,1 mm près), hauteurs de
rebond d'une balle lâchée, grille de collision identique au test de tous les obstacles,
précision sur les 7 pistes, et le protocole du serveur de bout en bout.

Aucun ne compile plus sur le code actuel. Ceux du serveur (`internal/game`) lisent l'ancien
instantané binaire, remplacé par les trajectoires : leur lecture du protocole est à réécrire.
Ceux du moteur et des pistes appellent `World.Step`, devenu `World.Advance` (une balle à la fois),
et ce que la simplification avait retiré parce que ça ne servait qu'à eux : le réglage
`World.Fine` (pas N fois plus fins), la constante exportée `physics.Frame` et la taille de
cellule en paramètre de `grid.build`.

Limites connues :

- plus aucun filet automatique : un changement du moteur, du protocole ou du client n'est plus
  vérifié que si on l'essaie à la main. Les outils qui ont vérifié les trajectoires et le client
  (serveur instrumenté, comparaison avec ce qu'un client affiche, pilotage de Chrome) n'ont pas
  été gardés dans le dépôt ;
- le ressenti n'a été jugé par personne : les mesures disent que le moteur est fidèle et
  régulier, pas qu'il est agréable ;
- sur la piste `bowl`, 11 tirs sur 72 restent à plus de 1 cm de la vérité : les plis entre deux
  pentes amplifient le moindre écart ;
- les collisions entre balles sont trouvées sur la ligne droite de chaque balle à travers
  l'image, pas sur sa vraie trajectoire (qui peut rebondir dans l'image). Trois balles posées au
  même point se chevauchent encore une image (0,13 rayon au plus). Le ressenti n'en a pas été jugé ;
- seul Chrome sans écran a piloté le client ; Windows et macOS sont seulement
  compilés.

## Ensuite

L'avant-partie est faite, le moteur des modificateurs aussi. Reste, côté client, la partie
elle-même : son interface (menu, quitter, scores), ses graphismes (le style, les modèles et l'aspect de chaque zone sont là, voir « Les modèles 3D ») et le tactile. Puis les cartes et les règles de salle. Points à garder en tête :

- tout ce qui bouge dépend du numéro d'image et de rien d'autre (ni l'heure, ni le hasard), sinon
  une trajectoire calculée d'avance ne sera plus celle que le jeu suivra ;
- deux manques connus côté règles : le propriétaire peut relancer une partie en cours
  (le client ne l'offre pas) ; aucune pause entre deux trous.
