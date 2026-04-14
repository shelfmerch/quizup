require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Category = require("../models/Category");
const Question = require("../models/Question");
const User = require("../models/User");

// ─── Seed data (mirrors frontend mock-data.ts) ────────────────────────────────
const CATEGORIES = [
  { slug: "science",    name: "Science",      icon: "🔬", color: "160 84% 44%", description: "Physics, Chemistry, Biology and more",   questionCount: 7 },
  { slug: "geography",  name: "Geography",    icon: "🌍", color: "210 90% 55%", description: "Countries, capitals, landmarks",          questionCount: 7 },
  { slug: "history",    name: "History",      icon: "📜", color: "38 92% 55%",  description: "Ancient to modern world history",         questionCount: 7 },
  { slug: "movies",     name: "Movies",       icon: "🎬", color: "0 72% 55%",   description: "Hollywood, Bollywood, and beyond",        questionCount: 7 },
  { slug: "sports",     name: "Sports",       icon: "⚽", color: "120 60% 45%", description: "Football, cricket, olympics",              questionCount: 7 },
  { slug: "music",      name: "Music",        icon: "🎵", color: "270 70% 60%", description: "Artists, albums, genres",                  questionCount: 7 },
  { slug: "technology", name: "Technology",   icon: "💻", color: "200 80% 50%", description: "Gadgets, coding, innovation",              questionCount: 7 },
  { slug: "literature", name: "Literature",   icon: "📚", color: "30 70% 50%",  description: "Books, authors, poetry",                   questionCount: 7 },
  { slug: "gaming",     name: "Gaming",       icon: "🎮", color: "280 80% 55%", description: "Video games, esports, retro",              questionCount: 7 },
  { slug: "food",       name: "Food & Drink", icon: "🍕", color: "15 85% 55%",  description: "Cuisine, recipes, beverages",              questionCount: 7 },
  { slug: "nature",     name: "Nature",       icon: "🌿", color: "140 70% 40%", description: "Animals, plants, ecosystems",              questionCount: 7 },
  { slug: "art",        name: "Art & Design", icon: "🎨", color: "320 70% 55%", description: "Painting, sculpture, design",              questionCount: 7 },
  { slug: "k-pop",      name: "K-Pop",        icon: "🎤", color: "330 80% 58%", description: "Korean pop, groups, and idols",            questionCount: 7 },
  { slug: "squid-game", name: "Squid Game",   icon: "🦑", color: "142 65% 42%", description: "The Netflix series — trivia and lore",   questionCount: 55 },
  { slug: "pak-dramas", name: "Pak Dramas",   icon: "🎬", color: "24 90% 55%",  description: "Pakistani dramas — iconic stories & characters", questionCount: 49 },
];

const QUESTIONS = {
  science: [
    { text: "What is the chemical symbol for gold?",                       options: ["Go","Gd","Au","Ag"],                        correctIndex: 2   },
    { text: "How many bones are in the adult human body?",                 options: ["196","206","216","186"],                    correctIndex: 1 },
    { text: "What planet is known as the Red Planet?",                     options: ["Venus","Mars","Jupiter","Saturn"],          correctIndex: 1   },
    { text: "What is the speed of light in km/s (approx)?",               options: ["300,000","150,000","500,000","250,000"],    correctIndex: 0   },
    { text: "What gas do plants absorb from the atmosphere?",             options: ["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"], correctIndex: 2 },
    { text: "What is the hardest natural substance on Earth?",            options: ["Titanium","Diamond","Quartz","Topaz"],      correctIndex: 1 },
    { text: "What is the powerhouse of the cell?",                        options: ["Nucleus","Ribosome","Mitochondria","Golgi body"], correctIndex: 2 },
  ],
  geography: [
    { text: "What is the capital of Australia?",                          options: ["Sydney","Melbourne","Canberra","Brisbane"],  correctIndex: 2 },
    { text: "Which is the longest river in the world?",                   options: ["Amazon","Nile","Yangtze","Mississippi"],    correctIndex: 1   },
    { text: "What country has the most islands?",                         options: ["Indonesia","Philippines","Sweden","Japan"], correctIndex: 2   },
    { text: "Mount Everest is located in which mountain range?",          options: ["Andes","Alps","Rockies","Himalayas"],       correctIndex: 3   },
    { text: "What is the smallest country in the world?",                 options: ["Monaco","Vatican City","San Marino","Liechtenstein"], correctIndex: 1 },
    { text: "Which desert is the largest in the world?",                  options: ["Sahara","Arabian","Gobi","Antarctic"],     correctIndex: 3   },
    { text: "What is the deepest ocean trench?",                          options: ["Tonga Trench","Mariana Trench","Java Trench","Puerto Rico Trench"], correctIndex: 1 },
  ],
  history: [
    { text: "In what year did World War II end?",                         options: ["1943","1944","1945","1946"],                correctIndex: 2   },
    { text: "Who was the first Emperor of Rome?",                         options: ["Julius Caesar","Augustus","Nero","Caligula"], correctIndex: 1 },
    { text: "The French Revolution began in which year?",                 options: ["1776","1789","1799","1804"],                correctIndex: 1 },
    { text: "Who built the Great Wall of China?",                         options: ["Ming Dynasty","Qin Dynasty","Han Dynasty","Multiple Dynasties"], correctIndex: 3 },
    { text: "Which civilization built Machu Picchu?",                     options: ["Maya","Aztec","Inca","Olmec"],              correctIndex: 2   },
    { text: "Who painted the Mona Lisa?",                                 options: ["Michelangelo","Raphael","Da Vinci","Botticelli"], correctIndex: 2 },
    { text: "The Berlin Wall fell in which year?",                        options: ["1987","1988","1989","1990"],                correctIndex: 2   },
  ],
  movies: [
    { text: "Who directed 'The Dark Knight'?",                            options: ["Spielberg","Nolan","Scorsese","Cameron"],   correctIndex: 1   },
    { text: "Which movie won the first Academy Award for Best Picture?",  options: ["Wings","Sunrise","The Jazz Singer","Ben-Hur"], correctIndex: 0 },
    { text: "What year was the original Star Wars released?",             options: ["1975","1977","1979","1980"],                correctIndex: 1 },
    { text: "Who played Iron Man in the MCU?",                            options: ["Chris Evans","Mark Ruffalo","Robert Downey Jr.","Chris Hemsworth"], correctIndex: 2 },
    { text: "What film features the line 'Here's looking at you, kid'?",  options: ["Casablanca","Gone with the Wind","Citizen Kane","Rebecca"], correctIndex: 0 },
    { text: "Which studio produced 'Toy Story'?",                         options: ["DreamWorks","Pixar","Blue Sky","Illumination"], correctIndex: 1 },
    { text: "What is the highest-grossing film of all time (unadjusted)?", options: ["Titanic","Avatar","Avengers: Endgame","The Lion King"], correctIndex: 2 },
  ],
  sports: [
    { text: "How many players are on a standard football (soccer) team?", options: ["9","10","11","12"],                         correctIndex: 2   },
    { text: "Which country has won the most FIFA World Cups?",             options: ["Germany","Argentina","Brazil","France"],    correctIndex: 2 },
    { text: "In which sport is the 'Grand Slam' a major achievement?",    options: ["Cricket","Tennis","Golf","All of these"],  correctIndex: 3 },
    { text: "How many rings are on the Olympic flag?",                    options: ["4","5","6","7"],                           correctIndex: 1   },
    { text: "What is the length of a marathon in km (approx)?",           options: ["40","42.195","44","45"],                   correctIndex: 1 },
    { text: "Which country invented basketball?",                         options: ["USA","Canada","UK","Australia"],           correctIndex: 0 },
    { text: "Who holds the record for most Olympic gold medals?",         options: ["Usain Bolt","Carl Lewis","Michael Phelps","Mark Spitz"], correctIndex: 2 },
  ],
  music: [
    { text: "How many strings does a standard guitar have?",              options: ["4","5","6","7"],                           correctIndex: 2   },
    { text: "Who is known as the 'King of Pop'?",                         options: ["Elvis Presley","Prince","Michael Jackson","James Brown"], correctIndex: 2 },
    { text: "Which band wrote 'Bohemian Rhapsody'?",                      options: ["Led Zeppelin","The Rolling Stones","Queen","The Who"], correctIndex: 2 },
    { text: "What does 'BPM' stand for in music?",                        options: ["Bass Per Measure","Beats Per Minute","Beat Per Melody","Bass Per Minute"], correctIndex: 1 },
    { text: "How many notes are in a standard Western musical scale?",    options: ["5","7","8","12"],                          correctIndex: 1 },
    { text: "Which instrument has 88 keys?",                              options: ["Organ","Harpsichord","Piano","Synthesizer"], correctIndex: 2 },
    { text: "What music genre originated in 1970s New York?",             options: ["Jazz","Hip-Hop","Blues","Reggae"],         correctIndex: 1 },
  ],
  technology: [
    { text: "What does 'HTTP' stand for?",                                 options: ["HyperText Transfer Protocol","High Transfer Text Protocol","Hyper Transfer Text Provider","HyperText Transit Protocol"], correctIndex: 0 },
    { text: "Who co-founded Apple with Steve Jobs?",                       options: ["Bill Gates","Steve Wozniak","Paul Allen","Jony Ive"], correctIndex: 1 },
    { text: "What language is used to style web pages?",                  options: ["HTML","JavaScript","CSS","Python"],        correctIndex: 2   },
    { text: "What does 'GPU' stand for?",                                  options: ["General Processing Unit","Graphics Processing Unit","Gigabit Processing Unit","Global Processing Unit"], correctIndex: 1 },
    { text: "What year was the first iPhone released?",                    options: ["2005","2006","2007","2008"],               correctIndex: 2 },
    { text: "What is the base of the binary number system?",              options: ["8","10","2","16"],                         correctIndex: 2   },
    { text: "Who invented the World Wide Web?",                            options: ["Bill Gates","Tim Berners-Lee","Vint Cerf","Steve Jobs"], correctIndex: 1 },
  ],
  literature: [
    { text: "Who wrote '1984'?",                                           options: ["Aldous Huxley","George Orwell","Ray Bradbury","H.G. Wells"], correctIndex: 1 },
    { text: "Who wrote 'Pride and Prejudice'?",                            options: ["Charlotte Brontë","Mary Shelley","Jane Austen","George Eliot"], correctIndex: 2 },
    { text: "In which Shakespeare play does Hamlet appear?",              options: ["Othello","Hamlet","Macbeth","King Lear"],  correctIndex: 1   },
    { text: "What is the name of Sherlock Holmes' address?",              options: ["10 Downing St","221B Baker St","4 Privet Drive","13 Baker St"], correctIndex: 1 },
    { text: "Who wrote 'The Great Gatsby'?",                               options: ["Ernest Hemingway","F. Scott Fitzgerald","John Steinbeck","William Faulkner"], correctIndex: 1 },
    { text: "Which novel starts with 'Call me Ishmael'?",                 options: ["Moby Dick","Lord Jim","Billy Budd","The Old Man and the Sea"], correctIndex: 0 },
    { text: "What is the first book of the Bible?",                        options: ["Exodus","Leviticus","Genesis","Numbers"],  correctIndex: 2   },
  ],
  gaming: [
    { text: "What year was Minecraft first released?",                    options: ["2008","2009","2010","2011"],               correctIndex: 2 },
    { text: "Which company created Fortnite?",                            options: ["Activision","EA","Epic Games","Ubisoft"],  correctIndex: 2   },
    { text: "What is the best-selling video game of all time?",           options: ["Tetris","GTA V","Minecraft","Wii Sports"], correctIndex: 2 },
    { text: "Who is the main character of 'The Legend of Zelda'?",        options: ["Zelda","Link","Ganon","Epona"],            correctIndex: 1   },
    { text: "In Pokémon, what type is Charizard?",                        options: ["Fire","Fire/Dragon","Fire/Flying","Dragon"], correctIndex: 2 },
    { text: "What franchise features Master Chief?",                       options: ["Gears of War","Halo","Call of Duty","Doom"], correctIndex: 1 },
    { text: "Which gaming company created Mario?",                        options: ["Sega","Atari","Nintendo","Sony"],          correctIndex: 2   },
  ],
  food: [
    { text: "What country does pizza originate from?",                    options: ["USA","France","Italy","Greece"],           correctIndex: 2   },
    { text: "How many tablespoons are in a cup?",                         options: ["8","12","16","20"],                        correctIndex: 2 },
    { text: "What is the main ingredient in guacamole?",                  options: ["Tomato","Avocado","Pepper","Corn"],        correctIndex: 1   },
    { text: "Which country is known for inventing sushi?",                options: ["China","South Korea","Japan","Vietnam"],   correctIndex: 2   },
    { text: "What is the most consumed beverage in the world (after water)?", options: ["Coffee","Beer","Juice","Tea"],         correctIndex: 3 },
    { text: "Brie is a type of what?",                                    options: ["Bread","Wine","Cheese","Pasta"],           correctIndex: 2   },
    { text: "What spice is the most expensive by weight?",                options: ["Vanilla","Cardamom","Saffron","Black Pepper"], correctIndex: 2 },
  ],
  nature: [
    { text: "What is the fastest land animal?",                           options: ["Lion","Leopard","Cheetah","Greyhound"],    correctIndex: 2   },
    { text: "What is the largest mammal?",                                options: ["Elephant","Blue Whale","Giraffe","Hippo"], correctIndex: 1   },
    { text: "How many legs does a spider have?",                          options: ["6","8","10","12"],                         correctIndex: 1   },
    { text: "What is the process by which plants make food?",             options: ["Respiration","Fermentation","Photosynthesis","Osmosis"], correctIndex: 2 },
    { text: "How many hearts does an octopus have?",                     options: ["1","2","3","4"],                           correctIndex: 2   },
    { text: "What is the tallest type of grass?",                        options: ["Sugarcane","Bamboo","Wheat","Corn"],       correctIndex: 1 },
    { text: "Which is the only bird that can fly backwards?",             options: ["Swallow","Hummingbird","Kingfisher","Swift"], correctIndex: 1 },
  ],
  art: [
    { text: "Who painted the Sistine Chapel ceiling?",                    options: ["Da Vinci","Raphael","Michelangelo","Donatello"], correctIndex: 2 },
    { text: "What art movement did Salvador Dalí belong to?",             options: ["Cubism","Impressionism","Surrealism","Dadaism"], correctIndex: 2 },
    { text: "What colour do you get mixing red and blue?",                options: ["Green","Purple","Orange","Brown"],         correctIndex: 1   },
    { text: "Who created 'The Starry Night'?",                            options: ["Claude Monet","Paul Gauguin","Van Gogh","Cézanne"], correctIndex: 2 },
    { text: "What is the term for a picture made from small tiles?",      options: ["Fresco","Mosaic","Collage","Mural"],       correctIndex: 1 },
    { text: "Which museum houses the Mona Lisa?",                         options: ["Uffizi","Prado","Louvre","Metropolitan"],   correctIndex: 2   },
    { text: "What painting technique involves applying thick layers of paint?", options: ["Watercolour","Impasto","Glazing","Sgraffito"], correctIndex: 1 },
  ],
  "k-pop": [
    { text: "Which company (label) is home to the group BTS?", options: ["SM Entertainment", "YG Entertainment", "HYBE (BigHit)", "JYP Entertainment"], correctIndex: 2 },
    { text: "What does 'K-Pop' stand for?", options: ["Korean Popular music", "Kyoto Pop", "Kinetic Pop", "K-Performance"], correctIndex: 0 },
    { text: "Which girl group released 'How You Like That'?", options: ["TWICE", "BLACKPINK", "(G)I-DLE", "aespa"], correctIndex: 1 },
    { text: "In which city is K-Pop's 'Big 3' traditionally centered?", options: ["Busan", "Incheon", "Seoul", "Daegu"], correctIndex: 2 },
    { text: "What is a common name for passionate K-Pop fans?", options: ["Swifties", "ARMY / fandom names", "Beliebers", "Directioners"], correctIndex: 1 },
    { text: "Which boy group is known for the song 'Sorry, Sorry'?", options: ["BIGBANG", "Super Junior", "EXO", "SHINee"], correctIndex: 1 },
    { text: "What is a 'comeback' in K-Pop?", options: ["A tour only", "A new album or single release cycle", "A disbandment", "A TV drama role"], correctIndex: 1 },
  ],
  "squid-game": [
    // First 21: 15 text (orig Q3–5,9–19) + 6 images at slots 2,6,10,13,16,20 (1-based). Tail: remaining 34 text (orig Q1–2,6–8,20–49).
    { text: "What shape is on the guards' masks?", options: ["Star", "Square / Triangle / Circle", "Diamond", "Cross"], correctIndex: 1 },
    { text: "What is the number of the main character in this scene?", options: ["218", "456", "067", "101"], correctIndex: 1, timeLimit: 5, imageUrl: "/uploads/squid-seed/player-456.png" },
    { text: "Who is Player 001?", options: ["The Front Man", "Oh Il-nam", "Ali", "Sang-woo"], correctIndex: 1 },
    { text: "What is the prize money?", options: ["10 billion won", "45.6 billion won", "100 billion won", "1 billion won"], correctIndex: 1 },
    { text: "Who cheats Ali?", options: ["Gi-hun", "Deok-su", "Sang-woo", "Front Man"], correctIndex: 2 },
    { text: "What game is being played in this scene?", options: ["Tug of War", "Red Light, Green Light", "Marbles", "Glass Bridge"], correctIndex: 1, timeLimit: 6, imageUrl: "/uploads/squid-seed/red-light-doll.png" },
    { text: "What is the final game?", options: ["Tug of War", "Squid Game", "Marbles", "Glass Bridge"], correctIndex: 1 },
    { text: "What color are the guards' uniforms?", options: ["Blue", "Green", "Pink/Red", "Black"], correctIndex: 2 },
    { text: "What color are players' tracksuits?", options: ["Red", "Blue", "Green", "Yellow"], correctIndex: 2 },
    { text: "Which player number does this character have?", options: ["218", "067", "101", "456"], correctIndex: 1, timeLimit: 5, imageUrl: "/uploads/squid-seed/player-067.png" },
    { text: "Who is the Front Man?", options: ["Gi-hun", "Jun-ho's brother", "Sang-woo", "Ali"], correctIndex: 1 },
    { text: "What is the third game?", options: ["Tug of War", "Marbles", "Honeycomb", "Glass Bridge"], correctIndex: 0 },
    { text: "What shape must the player carve out in this scene?", options: ["Star", "Circle", "Triangle", "Depends on assigned shape"], correctIndex: 3, timeLimit: 7, imageUrl: "/uploads/squid-seed/dalgona-players.png" },
    { text: "Who falls during Tug of War?", options: ["Sae-byeok", "Deok-su's team", "Gi-hun", "Ali"], correctIndex: 1 },
    { text: "What happens if you lose a game?", options: ["You retry", "You leave", "You are eliminated (killed)", "You get points"], correctIndex: 2 },
    { text: "What do these symbols represent in the series?", options: ["Player ranks", "Guard hierarchy", "Game levels", "Team divisions"], correctIndex: 1, timeLimit: 7, imageUrl: "/uploads/squid-seed/invitation-symbols.png" },
    { text: "Who is Abdul Ali?", options: ["Player 101", "Player 199", "Player 456", "Player 001"], correctIndex: 1 },
    { text: "What game uses marbles?", options: ["4th game", "1st game", "Final game", "2nd game"], correctIndex: 0 },
    { text: "Who tricks Player 001?", options: ["Sang-woo", "Gi-hun", "Deok-su", "Ali"], correctIndex: 1 },
    { text: "What is the purpose of this structure in the game?", options: ["Living quarters", "Game arena", "Player movement between games", "Control center"], correctIndex: 2, timeLimit: 6, imageUrl: "/uploads/squid-seed/maze-stairs.png" },
    { text: "What is the VIPs' role?", options: ["Players", "Guards", "Spectators betting on games", "Workers"], correctIndex: 2 },
    { text: "What is Seong Gi-hun's player number?", options: ["001", "067", "456", "218"], correctIndex: 2 },
    { text: "What game is played in the first round?", options: ["Tug of War", "Red Light, Green Light", "Marbles", "Glass Bridge"], correctIndex: 1 },
    { text: "Who is Kang Sae-byeok?", options: ["Player 218", "Player 067", "Player 456", "Player 001"], correctIndex: 1 },
    { text: "What is the second game?", options: ["Honeycomb (Dalgona)", "Marbles", "Tug of War", "Glass Bridge"], correctIndex: 0 },
    { text: "Which shape is hardest in honeycomb?", options: ["Circle", "Triangle", "Star", "Umbrella"], correctIndex: 3 },
    { text: "What shape has highest rank among guards?", options: ["Circle", "Triangle", "Square", "Star"], correctIndex: 2 },
    { text: "What weapon do triangle guards carry?", options: ["Knife", "Gun", "Stick", "Rope"], correctIndex: 1 },
    { text: "Who is Hwang Jun-ho?", options: ["Player", "Police officer undercover", "VIP", "Guard"], correctIndex: 1 },
    { text: "Where are the games held?", options: ["City", "Island facility", "School", "Prison"], correctIndex: 1 },
    { text: "What is the glass bridge game about?", options: ["Jumping randomly", "Choosing strong glass panels", "Swimming", "Running"], correctIndex: 1 },
    { text: "Who pushes others in glass bridge?", options: ["Gi-hun", "Deok-su", "Ali", "Il-nam"], correctIndex: 1 },
    { text: "What happens to Deok-su?", options: ["Wins", "Escapes", "Falls from bridge with Mi-nyeo", "Joins guards"], correctIndex: 2 },
    { text: "Who is Han Mi-nyeo?", options: ["Player 101's partner", "Guard", "VIP", "Doctor"], correctIndex: 0 },
    { text: "What do players vote for?", options: ["Prize", "Continue or stop games", "Food", "Teams"], correctIndex: 1 },
    { text: "What happens if majority votes to stop?", options: ["Game continues", "Everyone dies", "Players go home with money split", "Restart"], correctIndex: 2 },
    { text: "What is Gi-hun's personality?", options: ["Ruthless", "Kind-hearted but flawed", "Evil", "Silent"], correctIndex: 1 },
    { text: "What does Gi-hun promise Sae-byeok?", options: ["Money", "Help her family", "Escape", "Food"], correctIndex: 1 },
    { text: "Who dies before final game?", options: ["Sae-byeok", "Gi-hun", "Front Man", "VIP"], correctIndex: 0 },
    { text: "How does Sang-woo die?", options: ["Shot", "Falls", "Suicide during final game", "Poison"], correctIndex: 2 },
    { text: "What symbol is on invitation card?", options: ["Triangle, circle, square", "Star", "Heart", "Arrow"], correctIndex: 0 },
    { text: "What number is Sang-woo?", options: ["001", "067", "218", "456"], correctIndex: 2 },
    { text: "What does the doll detect?", options: ["Heat", "Sound", "Movement", "Light"], correctIndex: 2 },
    { text: "What language do VIPs speak?", options: ["Korean", "English mostly", "Chinese", "Japanese"], correctIndex: 1 },
    { text: "What is inside the piggy bank?", options: ["Food", "Prize money accumulating", "Weapons", "Masks"], correctIndex: 1 },
    { text: "Who organizes the game?", options: ["Government", "Rich elites (VIPs)", "Police", "Players"], correctIndex: 1 },
    { text: "What is the shape of the arena in final game?", options: ["Circle", "Triangle", "Squid shape", "Square"], correctIndex: 2 },
    { text: "What does Front Man do to Jun-ho?", options: ["Saves him", "Arrests him", "Shoots him", "Ignores him"], correctIndex: 2 },
    { text: "What motivates most players?", options: ["Fame", "Debt and money problems", "Revenge", "Fun"], correctIndex: 1 },
    { text: "What happens after Gi-hun wins?", options: ["Spends money", "Becomes rich instantly", "Lives in guilt and doesn't use money", "Leaves country"], correctIndex: 2 },
    { text: "What color is the invitation card?", options: ["Black", "Pink/Red", "Blue", "Green"], correctIndex: 1 },
    { text: "What food is given often?", options: ["Steak", "Eggs and soda", "Rice only", "Bread"], correctIndex: 1 },
    { text: "What do workers harvest from bodies?", options: ["Blood", "Organs illegally", "Clothes", "Weapons"], correctIndex: 1 },
    { text: "What does Gi-hun dye his hair at the end?", options: ["Black", "Blonde", "Red", "Blue"], correctIndex: 2 },
    { text: "What does Gi-hun decide at the end?", options: ["Leave country", "Rejoin games", "Turn back to confront organizers", "Quit life"], correctIndex: 2 },
  ],
  "pak-dramas": [
    { text: "Which drama features Mir Hadi & Umera Ahmed storyline?", options: ["Humsafar", "Khaani", "Zindagi Gulzar Hai", "Mere Paas Tum Ho"], correctIndex: 1 },
    { text: "In Humsafar, why do Khirad and Ashar separate?", options: ["Career issues", "Family misunderstanding", "Financial problems", "Infidelity"], correctIndex: 1 },
    { text: "Who plays Kashaf in Zindagi Gulzar Hai?", options: ["Mahira Khan", "Sanam Saeed", "Sajal Aly", "Ayeza Khan"], correctIndex: 1 },
    { text: "In Mere Paas Tum Ho, what causes the main conflict?", options: ["Business rivalry", "Love triangle and betrayal", "Family politics", "Crime"], correctIndex: 1 },
    { text: "What type of relationship dynamic is MOST likely shown here?", options: ["Light comedy", "Toxic romance / intense conflict", "Friendship", "Family bonding"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-01-couple-intense.png" },
    { text: "Which drama is based on honor killing theme?", options: ["Udaari", "Sang-e-Mar Mar", "Sang-e-Mah", "Diyar-e-Dil"], correctIndex: 2 },
    { text: "In Khaani, what is the turning point?", options: ["Marriage", "Murder of Khaani’s brother", "Court case", "Kidnapping"], correctIndex: 1 },
    { text: "What does this kind of cast poster usually indicate?", options: ["Comedy drama", "Ensemble family drama with multiple arcs", "Horror", "Documentary"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-02-cast-black.png" },
    { text: "Which drama highlights child abuse issues?", options: ["Udaari", "Cheekh", "Ranjha Ranjha Kardi", "Ishqiya"], correctIndex: 0 },
    { text: "Who is the lead male in Ibn-e-Hayat?", options: ["Humayun Saeed", "Imran Abbas", "Mikaal Zulfiqar", "Ahsan Khan"], correctIndex: 3 },
    { text: "In Cheekh, what drives the story forward?", options: ["Revenge for murder", "Political power", "Business loss", "Family drama"], correctIndex: 0 },
    { text: "What genre is MOST likely for this drama?", options: ["Sci-fi", "Romantic thriller / family drama", "Fantasy", "Sports"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-04-ary-promo.png" },
    { text: "Which drama features the character Parizaad?", options: ["Parizaad", "Khuda Aur Mohabbat", "Sinf-e-Aahan", "Ishq Jalebi"], correctIndex: 0 },
    { text: "What phase of the story does this scene MOST likely represent?", options: ["Conflict peak", "Revenge arc", "Early romance / peaceful phase", "Tragic ending"], correctIndex: 2, imageUrl: "/uploads/pak-dramas-seed/pak-03-happy-couple.png" },
    { text: "What is Parizaad’s biggest struggle?", options: ["Wealth", "Appearance & self-worth", "Love triangle", "Career"], correctIndex: 1 },
    { text: "Which drama shows female empowerment in army training?", options: ["Sinf-e-Aahan", "Ehd-e-Wafa", "Alpha Bravo Charlie", "Diyar-e-Dil"], correctIndex: 0 },
    { text: "What is the central conflict usually in such dramas?", options: ["Career struggles", "Love triangle / betrayal", "War", "Crime investigation"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-05-urdu-title.png" },
    { text: "In Ehd-e-Wafa, what binds the main characters?", options: ["Family", "Friendship & military academy", "Politics", "Business"], correctIndex: 1 },
    { text: "Who is known as “Chaudhry Shabbir” in Mere Paas Tum Ho?", options: ["Adnan Siddiqui", "Humayun Saeed", "Noman Ijaz", "Firdous Jamal"], correctIndex: 2 },
    { text: "What storyline is MOST likely happening here?", options: ["Wedding celebration", "Forced marriage / emotional tension", "Comedy sequence", "Flashback"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-06-bride.png" },
    { text: "Which drama gained viral fame for dialogue “Do takay ki aurat”?", options: ["Mere Paas Tum Ho", "Khaani", "Humsafar", "Udaari"], correctIndex: 0 },
    { text: "In Khuda Aur Mohabbat, what is the core theme?", options: ["Revenge", "Spiritual love vs worldly love", "Politics", "Crime"], correctIndex: 1 },
    { text: "What role does such a character MOST often play?", options: ["Villain mastermind", "Central emotional lead", "Comic relief", "Side character"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-07-female-closeup.png" },
    { text: "Which actor played Farhad in Khuda Aur Mohabbat 3?", options: ["Feroze Khan", "Bilal Abbas", "Ahad Raza Mir", "Imran Ashraf"], correctIndex: 0 },
    { text: "In Ranjha Ranjha Kardi, what is the main focus?", options: ["Wealth", "Social inequality & obsession", "Politics", "Revenge"], correctIndex: 1 },
    { text: "What is being emphasized in this type of image?", options: ["Action sequence", "Character styling & social status", "Crime plot", "Political theme"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-08-fashion-portraits.png" },
    { text: "Which drama features Saba Qamar in a bold role?", options: ["Baaghi", "Udaari", "Cheekh", "Parizaad"], correctIndex: 0 },
    { text: "In Baaghi, whose life is the story based on?", options: ["Actress", "Social media personality (Qandeel Baloch)", "Politician", "Singer"], correctIndex: 1 },
    { text: "What theme is MOST strongly represented here?", options: ["Comedy", "Family conflict & authority dynamics", "Romance", "Friendship"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-09-slap-scene.png" },
    { text: "Which drama features Danish and Mehwish?", options: ["Mere Paas Tum Ho", "Khaani", "Humsafar", "Cheekh"], correctIndex: 0 },
    { text: "What role is this character MOST likely to play?", options: ["Villain", "Romantic lead / protagonist", "Comic sidekick", "Background extra"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-10-male-portrait.png" },
    { text: "In Ishq Jalebi, what tone dominates the drama?", options: ["Tragic", "Romantic comedy", "Horror", "Thriller"], correctIndex: 1 },
    { text: "Which drama revolves around corporate rivalry?", options: ["Jackson Heights", "Jalan", "Zindagi Gulzar Hai", "Diyar-e-Dil"], correctIndex: 2 },
    { text: "What drives the story in such setups?", options: ["Business", "Female rivalry / jealousy", "War", "Science"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-11-female-rivalry.png" },
    { text: "Who played Haider in Raqs-e-Bismil?", options: ["Imran Ashraf", "Bilal Abbas", "Feroze Khan", "Ahad Raza Mir"], correctIndex: 0 },
    { text: "In Raqs-e-Bismil, what is Haider’s hidden passion?", options: ["Music", "Dance", "Writing", "Acting"], correctIndex: 1 },
    { text: "What kind of storyline is MOST likely?", options: ["Corporate rivalry", "Cultural romance / arranged marriage", "Crime thriller", "Fantasy"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-12-couple-traditional.png" },
    { text: "Which drama focuses on toxic marriage?", options: ["Jalan", "Humsafar", "Udaari", "Ehd-e-Wafa"], correctIndex: 0 },
    { text: "In Diyar-e-Dil, what theme dominates?", options: ["War", "Family relationships & forgiveness", "Crime", "Politics"], correctIndex: 1 },
    { text: "What tone does this drama MOST likely have?", options: ["Lighthearted", "Dark, serious, emotional conflict", "Comedy", "Musical"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-13-dark-cast.png" },
    { text: "Which drama includes university romance turning into marriage struggles?", options: ["Humsafar", "Zindagi Gulzar Hai", "Cheekh", "Udaari"], correctIndex: 1 },
    { text: "In Sang-e-Mah, what is central?", options: ["Romance", "Tribal justice & revenge", "Comedy", "Corporate life"], correctIndex: 1 },
    { text: "Which drama features Ahad Raza Mir & Sajal Aly together?", options: ["Yakeen Ka Safar", "Parizaad", "Cheekh", "Baaghi"], correctIndex: 0 },
    { text: "What narrative structure is shown here?", options: ["Single timeline", "Parallel love stories / multiple arcs", "Documentary", "Game show"], correctIndex: 1, imageUrl: "/uploads/pak-dramas-seed/pak-14-split-love.png" },
    { text: "In Yakeen Ka Safar, what is the core theme?", options: ["Revenge", "Healing & personal growth", "Politics", "Crime"], correctIndex: 1 },
    { text: "Which drama is set around media industry struggles?", options: ["Baaghi", "Jalan", "Jackson Heights", "Ishqiya"], correctIndex: 3 },
    { text: "In Ishqiya, what complicates relationships?", options: ["Money", "Jealousy & love triangle", "Politics", "Crime"], correctIndex: 1 },
    { text: "Which drama showcases rural life & culture strongly?", options: ["Sang-e-Mar Mar", "Cheekh", "Parizaad", "Jalan"], correctIndex: 0 },
    { text: "In Sang-e-Mar Mar, what drives conflict?", options: ["Wealth", "Tribal honor & traditions", "Love triangle", "Career"], correctIndex: 1 },
  ],
};

// ─── Seed runner ──────────────────────────────────────────────────────────────
const seed = async () => {
  await connectDB();
  console.log("\n🌱  Starting seed...\n");

  // 1. Categories
  let catCount = 0;
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate(
      { slug: cat.slug },
      cat,
      { upsert: true, new: true }
    );
    catCount++;
  }
  console.log(`✅  Upserted ${catCount} categories`);

  // 2. Questions
  let qCount = 0;
  for (const [categoryId, questions] of Object.entries(QUESTIONS)) {
    if (categoryId === "squid-game") {
      await Question.deleteMany({ categoryId: "squid-game" });
    }
    for (const q of questions) {
      await Question.findOneAndUpdate(
        { categoryId, text: q.text },
        { ...q, categoryId, timeLimit: q.timeLimit != null ? q.timeLimit : 10, isActive: true },
        { upsert: true, new: true }
      );
      qCount++;
    }
    // Update category questionCount
    const total = await Question.countDocuments({ categoryId, isActive: true });
    await Category.findOneAndUpdate({ slug: categoryId }, { questionCount: total });
  }
  console.log(`✅  Upserted ${qCount} questions`);

  // 3. Demo users
  const demoUsers = [
    { username: "DemoPlayer",  email: "demo@quizup.com",    password: "demo1234", country: "🇺🇸", bio: "Demo player account" },
    { username: "Player2Demo", email: "player2@quizup.com", password: "demo1234", country: "🇬🇧", bio: "Second demo account for testing" },
  ];

  for (const u of demoUsers) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      const passwordHash = await User.hashPassword(u.password);
      await User.create({
        username: u.username,
        email: u.email,
        passwordHash,
        bio: u.bio,
        country: u.country,
        displayName: u.username,
      });
      console.log(`✅  Created demo user: ${u.email} / ${u.password}`);
    } else {
      console.log(`⏭️   Demo user already exists: ${u.email}`);
    }
  }

  // 4. Admin account (Quiz CMS)
  const adminEmail = "admin@quiz.com";
  const adminPassword = "admin123";
  const adminHash = await User.hashPassword(adminPassword);
  const adminExisting = await User.findOne({ email: adminEmail });
  if (!adminExisting) {
    await User.create({
      username: "admin",
      email: adminEmail,
      passwordHash: adminHash,
      displayName: "Admin",
      role: "admin",
    });
    console.log(`✅  Created admin: ${adminEmail} / ${adminPassword}`);
  } else {
    await User.findOneAndUpdate(
      { email: adminEmail },
      { passwordHash: adminHash, role: "admin", username: "admin" }
    );
    console.log(`✅  Ensured admin account: ${adminEmail} / ${adminPassword}`);
  }

  console.log("\n🎉  Seed complete!\n");
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
