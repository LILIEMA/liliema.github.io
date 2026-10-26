# LILIEMA apps: filming copy

A copy of the Helsinki Book Fair pages (`../bookfair/`) for the filming day of 28 October 2026 (Kielivoimat, the promotional film of the Bachelor's Programme in Languages, University of Helsinki). Built by `make_film_pages.py` (Claude for Friederike Lüpke); do not edit by hand.

It uses its own Supabase project, separate from the fair's. Its words are LILIEMA's own: the Baïnounk Gujaher lexicon and the Karabane and Samine workshop words, without the entries from published dictionaries. No fair visitor's words or answers are shown. Check the AI has the AI's words in the fair's 16 languages and in 14 more languages of Senegal (Baïnounk Gujaher and the 13 others of LILIEMA's language table), written by Claude (Anthropic) from the model's own knowledge, without dictionaries or web search. Address: https://liliema.github.io/film/?lang=fi

Technical development: Friederike Lüpke. Co-developed with the participants of the 2026 LILIEMA workshops in Samine (Senegal) and Sanyang (The Gambia). Pictures: Unni Pohjonen for LILIEMA, CC BY 4.0 (see ../bookfair/pictures/README.md).

The copy is also used for a teaching demo in November 2026. After that, it is replaced by a page that forwards to https://liliema.wordpress.com, and the Supabase project is deleted.

## Session wall (scene 4)

`session.html` is a full-screen word wall for one session. It is empty when it is started (Enter) and then shows every word added with Add a word: the word in large type with its language underneath, and a word that the same person adds for the same picture in another language as a second line (column `word_group`, see `film_session_wall.sql` in liliema-ops). Up to 30 tiles (26 while the code is shown) on a grid of 6 by 5; `?cols=5&rows=4` gives a smaller grid with larger words. Address for the shoot: https://liliema.github.io/film/session.html?lang=en

With `&pic=cat`, the wall shows the cat in the middle from the start (on the start screen too), with the question what it is called in your languages, and its code opens Add a word on the cat, so that everyone enters the same word. The key P moves on to the next picture (Shift+P goes back): the code changes with it and the words already on the wall stay, so that the wall fills with words for many pictures (20 words a page on the usual grid, around the picture). After the cat, the pictures follow in the order of Add a word; for an order of your own, list them: `&pic=cat,dog,sun,mango` (the pictures' names in English, as in the file names of `../bookfair/pictures/`, for example `cooking_pot`, or in Finnish, Swedish or French). People can still choose another picture on their phones. Address with the cat: https://liliema.github.io/film/session.html?lang=en&pic=cat

Keys: Enter starts it in full screen, F full screen, Q shows or hides the code, the arrow keys change the page, Backspace hides the newest word, N twice starts a new round (the wall empties; the words stay in the database), D shows sample words for checking the screen (never saved), L light or dark background, ? help.

To empty the word store after a test (the words typed on the pages and the answers of Check the AI; LILIEMA's own words, the wordlist and the AI's words stay), run in the SQL Editor of the filming project: `select * from clear_film_words();`

Arabic script: the pages and the session wall show words in Arabic script (Arabic, Ajami, Persian, Urdu) in Noto Sans Arabic (SIL Open Font License, `assets/fonts`), right to left, and the text fields follow the direction of what is typed. Other scripts show in the device's own fonts.

---

# Applications LILIEMA : copie pour le tournage

Une copie des pages du Salon du livre d'Helsinki (`../bookfair/`) pour la journée de tournage du 28 octobre 2026 (Kielivoimat, le film de présentation du programme de licence en langues de l'Université d'Helsinki). Produite par `make_film_pages.py` (Claude pour Friederike Lüpke) ; ne pas modifier à la main.

Elle utilise son propre projet Supabase, distinct de celui du salon. Ses mots sont ceux de LILIEMA : le lexique du baïnounk gujaher et les mots des ateliers de Karabane et de Samine, sans les entrées tirées de dictionnaires publiés. Aucun mot ni aucune réponse des visiteurs du salon n'y figure. Vérifiez l'IA propose les mots de l'IA dans les 16 langues du salon et dans 14 autres langues du Sénégal (le baïnounk gujaher et les 13 autres du tableau des langues de LILIEMA), écrits par Claude (Anthropic) d'après les connaissances propres du modèle, sans dictionnaire ni recherche sur le web. Adresse : https://liliema.github.io/film/?lang=fi

Développement technique : Friederike Lüpke. Outils co-développés avec les participant·e·s des ateliers LILIEMA 2026 à Samine (Sénégal) et Sanyang (Gambie). Images : Unni Pohjonen pour LILIEMA, CC BY 4.0 (voir ../bookfair/pictures/README.md).

La copie sert aussi à une démonstration en cours en novembre 2026. Ensuite, elle est remplacée par une page qui renvoie vers https://liliema.wordpress.com, et le projet Supabase est supprimé.

## Mur de la séance (scène 4)

`session.html` est un mur de mots en plein écran pour une séance. Il est vide au lancement (Entrée), puis affiche chaque mot ajouté avec Ajoutez un mot : le mot en grands caractères avec sa langue en dessous, et en deuxième ligne un mot que la même personne ajoute pour la même image dans une autre langue (colonne `word_group`, voir `film_session_wall.sql` dans liliema-ops). Jusqu'à 30 cases (26 tant que le code est affiché) sur une grille de 6 sur 5 ; `?cols=5&rows=4` donne une grille plus petite avec des mots plus grands. Adresse pour le tournage : https://liliema.github.io/film/session.html?lang=en

Avec `&pic=cat`, le mur affiche le chat au milieu dès le départ (et déjà sur l'écran de lancement), avec la question de son nom dans vos langues, et son code ouvre Ajoutez un mot sur le chat : tout le monde saisit le même mot. La touche P passe à l'image suivante (Maj+P revient en arrière) : le code change avec elle et les mots déjà affichés restent, si bien que le mur se remplit de mots pour de nombreuses images (20 mots par page sur la grille habituelle, autour de l'image). Après le chat, les images suivent l'ordre d'Ajoutez un mot ; pour un ordre à vous, énumérez-les : `&pic=cat,dog,sun,mango` (les noms des images en anglais, comme dans les noms de fichiers de `../bookfair/pictures/`, par exemple `cooking_pot`, ou en finnois, en suédois ou en français). Chacun peut toujours choisir une autre image sur son téléphone. Adresse avec le chat : https://liliema.github.io/film/session.html?lang=en&pic=cat

Touches : Entrée lance le mur en plein écran, F plein écran, Q affiche ou masque le code, les flèches changent de page, Backspace masque le mot le plus récent, N deux fois commence un nouveau tour (le mur se vide ; les mots restent dans la base de données), D affiche des mots d'exemple pour vérifier l'écran (jamais enregistrés), L fond clair ou sombre, ? aide.

Pour vider la base de mots après un test (les mots saisis sur les pages et les réponses de Vérifiez l'IA ; les mots de LILIEMA, la liste de mots et les mots de l'IA restent), exécutez dans le SQL Editor du projet de tournage : `select * from clear_film_words();`

Écriture arabe : les pages et le mur de la séance affichent les mots en écriture arabe (arabe, ajami, persan, ourdou) en Noto Sans Arabic (licence SIL Open Font, `assets/fonts`), de droite à gauche, et les champs de saisie suivent le sens de ce qui est tapé. Les autres écritures s'affichent avec les polices de l'appareil.
