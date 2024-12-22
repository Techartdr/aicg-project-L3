// Importation du moteur WebLLM pour générer des réponses
import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// ----------------- Constantes et paramètres du jeu -----------------
const SUMMARY_INTERVAL = 3;        // Résumé automatique toutes les 3 tours
const TEMP = 0.7;                 // Température pour la créativité des réponses
const REPETITION_PEN = 1.2;       // Pénalité pour éviter des répétitions excessives

// ----------------- Références aux éléments HTML -----------------
const modelSelect = document.getElementById("modelSelect"); // Sélecteur de modèle
const maxRoundsInput = document.getElementById("maxRoundsInput"); // Input pour le nombre de tours
const promptInput = document.getElementById("prompt"); // Zone de texte pour le prompt initial
const startBtn = document.getElementById("startBtn"); // Bouton pour démarrer l'aventure

// Sections du jeu
const gameSection = document.querySelector(".game-section"); // Zone de jeu principale
const storyContainer = document.getElementById("story-container"); // Conteneur de l'histoire
const choicesDiv = document.getElementById("choices"); // Conteneur pour les choix
const turnsLeftSpan = document.getElementById("turnsLeft"); // Indicateur des tours restants
const fullHistoryArea = document.getElementById("fullHistory"); // Zone pour l'historique complet
const saveHistoryBtn = document.getElementById("saveHistoryBtn"); // Bouton pour télécharger l'historique

// Références des éléments pour la barre de vie
const playerHealthElement = document.getElementById("playerHealth");
const healthFillElement = document.getElementById("healthFill");

// Références des éléments pour le lancer de dé
const rollDiceBtn = document.getElementById("rollDiceBtn");
const diceResultElement = document.getElementById("diceResult");

// ----------------- Variables globales -----------------
let engine = null;       // Instance du moteur WebLLM
let maxRounds = 3;       // Nombre maximum de tours défini par l'utilisateur
let currentRound = 0;    // Compteur de tours actuel

// État de l'histoire
let storyState = {
  initialContext: "",     // Contexte initial saisi par l'utilisateur
  summaryContext: "",     // Résumé automatique de l'aventure
  fullHistory: "",        // Historique complet du jeu
};

// Barre de vie initiale
let playerHealth = 100;

// ----------------- Gestionnaires d'événements -----------------

// Démarrage de l'aventure
startBtn.addEventListener('click', async () => {
  const ctx = promptInput.value.trim(); // Récupère le texte du prompt initial
  if (!ctx) {
    alert("Veuillez entrer la description de l'aventure que vous voulez vivre !");
    return;
  }

  modelSelect.disabled = true;
  maxRoundsInput.disabled = true;

  // Récupère le modèle sélectionné et initialise les paramètres
  const selectedModel = modelSelect.value;
  maxRounds = parseInt(maxRoundsInput.value, 10) || 3;

  // Initialisation de l'état de l'histoire
  storyState.initialContext = ctx;
  storyState.summaryContext = ctx;
  storyState.fullHistory = `--- Lancement ---\nHistoire initiale : ${ctx}\n\n`;
  currentRound = 0;

  // Mise à jour de l'interface utilisateur
  document.querySelector(".initial-section").style.display = "none";
  gameSection.hidden = false;
  turnsLeftSpan.textContent = maxRounds.toString();

  // Chargement du modèle d'IA si nécessaire
  if (!engine) {
    storyContainer.innerHTML = "<p>Chargement du modèle, cela prendra quelques instants...</p>";
    engine = await CreateMLCEngine(selectedModel);
    storyContainer.innerHTML = "";
  }

  // Génération de la première scène
  await generateNextScene();
});

// Téléchargement de l'historique complet
saveHistoryBtn.addEventListener('click', () => {
  const content = storyState.fullHistory;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "save_rpg_ia.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Gère le lancer de dé
rollDiceBtn.addEventListener("click", () => {
  const diceRoll = Math.floor(Math.random() * 6) + 1; // Génère un nombre entre 1 et 6
  diceResultElement.textContent = diceRoll;

  // Ajoutez ici toute logique ou effet spécial pour le lancer de dé si nécessaire
});

// ----------------- Fonctions principales -----------------

/**
 * Génère la scène suivante, y compris les choix proposés par l'IA.
 */
async function generateNextScene() {
  currentRound++;
  updateTurnsLeft();

  // Vérifie si la limite de tours est atteinte
  if (currentRound > maxRounds) {
    await generateEnding();
    return;
  }

  // Génère un résumé automatique tous les `SUMMARY_INTERVAL` tours
  if (currentRound % SUMMARY_INTERVAL === 0) {
    await autoSummarize();
  }

  // Prépare le prompt pour l'IA
  const userPrompt = `
Contexte initial : ${storyState.initialContext}

Résumé actuel : ${storyState.summaryContext}

Raconte la suite de l'histoire en 5 lignes maximum, puis donne EXACTEMENT 3 choix numérotés (1., 2., 3.).
Ne donne rien d'autre, pas de conclusion, pas de redite.
  `;
  const text = await generateText(userPrompt, {
    max_tokens: 250,
    temperature: TEMP,
    repetition_penalty: REPETITION_PEN,
    stream: true,
  });

  // Affiche le texte généré et met à jour l'historique
  const block = document.createElement("div");
  block.classList.add("story-block");
  storyContainer.appendChild(block);
  await typewriterText(block, text);

  storyState.fullHistory += `--- Tour ${currentRound} ---\n${text}\n\n`;
  fullHistoryArea.value = storyState.fullHistory;

  // Extraction et affichage des choix
  const [desc, choices] = extractChoices(text);

  if (choices.length < 3) {
    endAdventure("Fin de l'aventure : L'IA n'a pas pu fournir 3 choix.");
    return;
  }
  displayChoices(choices);
}

/**
 * Génère une conclusion satisfaisante pour l'histoire.
 */
async function generateEnding() {
  const userPrompt = `
Résumé final : ${storyState.summaryContext}

Conclut l'histoire de manière cohérente en 5 lignes maximum.
  `;
  const text = await generateText(userPrompt, {
    max_tokens: 200,
    temperature: TEMP,
    repetition_penalty: REPETITION_PEN,
    stream: true,
  });

  const block = document.createElement("div");
  block.classList.add("story-block");
  storyContainer.appendChild(block);
  await typewriterText(block, text);

  storyState.fullHistory += `--- Fin de l'aventure ---\n${text}\n\n`;
  fullHistoryArea.value = storyState.fullHistory;

  endAdventure("Aventure terminée !");
}

/**
 * Met à jour le compteur des tours restants.
 */
function updateTurnsLeft() {
  const remaining = maxRounds - currentRound;
  turnsLeftSpan.textContent = remaining >= 0 ? remaining.toString() : "0";
}

// ----------------- Fonctions auxiliaires -----------------

/**
 * Met à jour la barre de vie du joueur.
 * @param {number} damage - Points de dégâts à infliger.
 */
function updateHealth(damage) {
  playerHealth -= damage;
  if (playerHealth < 0) playerHealth = 0;

  playerHealthElement.textContent = `${playerHealth}%`;
  healthFillElement.style.width = `${playerHealth}%`;

  if (playerHealth === 0) {
    endAdventure("Le joueur est tombé au combat !");
  }
}

/**
 * Génère un texte en streaming à partir du modèle d'IA.
 */
async function generateText(prompt, genParams) {
  let finalText = "";
  const streamResult = await engine.chat.completions.create({
    messages: [
      { role: "system", content: "Tu es un maître du jeu en français." },
      { role: "user", content: prompt },
    ],
    ...genParams,
  });

  if (!genParams.stream) {
    finalText = streamResult.choices[0].message.content;
  } else {
    for await (const chunk of streamResult) {
      if (chunk.choices && chunk.choices[0]?.delta.content) {
        finalText += chunk.choices[0].delta.content;
      }
    }
  }
  return finalText.trim();
}

/**
 * Affiche du texte lettre par lettre.
 */
async function typewriterText(container, fullText, delay = 20) {
  for (let i = 0; i < fullText.length; i++) {
    container.textContent += fullText.charAt(i);
    await sleep(delay);
  }
  container.textContent += "\n";
}

/**
 * Extrait la description et les choix du texte généré par l'IA.
 */
function extractChoices(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const choiceLines = lines.filter(l => /^[1-3]\.\s/.test(l));

  let description = text;
  if (choiceLines.length > 0) {
    const firstIndex = lines.indexOf(choiceLines[0]);
    const descLines = lines.slice(0, firstIndex);
    description = descLines.join(' ');
  }

  return [description, choiceLines];
}

/**
 * Affiche les choix dans l'interface utilisateur.
 */
function displayChoices(choices) {
  choicesDiv.innerHTML = "";
  choices.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "btn-choice";
    btn.textContent = c;
    btn.addEventListener('click', () => handleChoice(c));
    choicesDiv.appendChild(btn);
  });
}

/**
 * Effectue une pause (utilisé pour les animations de texte).
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Génère automatiquement un résumé de l'aventure actuelle.
 */
async function autoSummarize() {
  const summaryPrompt = `
Voici un résumé de l'histoire jusqu'ici :
${storyState.summaryContext}

Résumé en 3 phrases maximum, tout en maintenant la continuité de l'histoire.
  `;
  const text = await generateText(summaryPrompt, {
    max_tokens: 150,
    temperature: 0.5,
    repetition_penalty: 1.2,
  });

  storyState.summaryContext = text;
  storyState.fullHistory += `--- Résumé automatique ---\n${text}\n\n`;
  fullHistoryArea.value = storyState.fullHistory;
}

/**
 * Gère la sélection d'un choix et passe à la scène suivante.
 */
function handleChoice(choiceText) {
  choicesDiv.innerHTML = "";
  storyState.fullHistory += `Choix du joueur : ${choiceText}\n\n`;
  fullHistoryArea.value = storyState.fullHistory;

  generateNextScene();
}
