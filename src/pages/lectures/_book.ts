// The lecture book: parts (tracks) and their chapters, in reading order.
// A chapter with an `href` is live; one without shows as "Coming soon".
// `index` lists a live lecture's section anchors with their index labels.

export type Lecture = {
	title: string;
	summary: string;
	topics: string[];
	href?: string;
	length?: string;
	index?: [string, string][];
};

export type Track = {
	id: string;
	name: string;
	short: string;
	blurb: string;
	lectures: Lecture[];
};

export const tracks: Track[] = [
	{
		id: "machine-learning",
		name: "Machine Learning",
		short: "ML",
		blurb:
			"Classical models that learn from data: the paradigms, regression and classification, evaluation, and finding structure without labels.",
		lectures: [
			{
				title: "Supervised Learning",
				summary:
					"The paradigm itself, from zero: learning from labelled examples, the map of its algorithms, a teach-it-yourself demo, a playground where six classifiers fit the same data, and an overfitting lab with live train-vs-test curves.",
				topics: [
					"Classification & regression",
					"The algorithm map",
					"k-NN, trees, forests",
					"Overfitting",
				],
				href: "/lectures/supervised-learning/",
				length: "~20 min",
				index: [
					["what", "Learning with an answer key"],
					["map", "A field guide to the algorithms"],
					["playground", "One dataset, six minds"],
					["overfit", "When memorising beats learning"],
					["recipe", "The recipe every model follows"],
					["choose", "Picking the right mind for the job"],
					["summary", "Five lines to remember"],
				],
			},
			{
				title: "Linear Regression",
				summary:
					"Drawing the best straight line through a cloud, three ways: drag it yourself, solve it in closed form, and watch gradient descent roll downhill to it — then bend it with features and tame it with regularisation.",
				topics: [
					"Least squares",
					"Normal equation",
					"Gradient descent",
					"R² & residuals",
					"Ridge & lasso",
				],
				href: "/lectures/linear-regression/",
				length: "~25 min",
				index: [
					["why", "The oldest line in data science"],
					["fit", "You draw it, the error judges"],
					["loss", "Why we square the misses"],
					["solve", "Solving it in one shot"],
					["gd", "Rolling downhill to the answer"],
					["score", "Grading the fit: R² and residuals"],
					["poly", "Bending a straight line"],
					["reg", "Ridge & lasso: a leash on the weights"],
					["project", "Forecasting diabetes, a year ahead"],
					["summary", "Five lines to remember"],
				],
			},
			{
				title: "Logistic Regression",
				summary:
					"Turning a line into a probability: the sigmoid, odds and log-odds, why we use log-loss instead of squared error, and the straight decision boundary it draws.",
				topics: [
					"The sigmoid squash",
					"Odds & log-odds",
					"Log-loss",
					"Decision threshold",
					"Softmax for many classes",
				],
			},
			{
				title: "LDA & QDA",
				summary:
					"Linear and Quadratic Discriminant Analysis: why we need both, how they work, the formulas, worked examples, an interactive playground — and a real tumour-screening project with a live decision-threshold explorer. Slides and PDF notes included.",
				topics: [
					"Classification",
					"Bayes' theorem",
					"Gaussian models",
					"Fisher's LDA",
				],
				href: "/lectures/lda-qda/",
				length: "~30 min",
				index: [
					["why", "Why one boundary isn't enough"],
					["basics", "Building blocks you can touch"],
					["foundation", "Bayes: flipping the question"],
					["lda", "LDA: one shared shape, one straight cut"],
					["qda", "QDA: every class its own shape"],
					["example", "The maths, by hand"],
					["playground", "Find where each one wins"],
					["compare", "Line vs curve: the face-off"],
					["project", "Screening real tumours"],
					["summary", "What to carry home"],
				],
			},
			{
				title: "Naive Bayes",
				summary:
					"The 'wrong' assumption that works: treating features as independent, counting words to catch spam, and smoothing away the zero-probability trap.",
				topics: [
					"Independence, naively",
					"Spam by word counts",
					"Laplace smoothing",
					"Gaussian vs multinomial",
				],
			},
			{
				title: "k-Nearest Neighbours",
				summary:
					"Judging by the company you keep: distance metrics, choosing k, why scaling matters, and how high dimensions make everyone a stranger.",
				topics: [
					"Distance, three ways",
					"Choosing k",
					"Feature scaling",
					"Curse of dimensionality",
				],
			},
			{
				title: "Decision Trees",
				summary:
					"Twenty questions, learned from data: entropy and Gini impurity, information gain, growing a tree split by split, and pruning it before it memorises.",
				topics: [
					"Entropy & Gini",
					"Information gain",
					"Growing a tree",
					"Pruning",
				],
			},
			{
				title: "Ensembles: Forests & Boosting",
				summary:
					"Many weak voters beat one expert: bagging and random forests, AdaBoost's focus on mistakes, and gradient boosting — the engine behind XGBoost.",
				topics: [
					"Wisdom of crowds",
					"Bagging & random forests",
					"AdaBoost",
					"Gradient boosting",
				],
			},
			{
				title: "Support Vector Machines",
				summary:
					"The widest street between two classes: margins and support vectors, soft margins for messy data, and the kernel trick that bends space.",
				topics: [
					"Maximum margin",
					"Support vectors",
					"Soft margin & C",
					"The kernel trick",
				],
			},
			{
				title: "Evaluating Models",
				summary:
					"How to know a model is good: train/validation/test splits, cross-validation, the confusion matrix, precision–recall, ROC curves and the bias–variance trade-off.",
				topics: [
					"Honest splits",
					"Cross-validation",
					"Precision & recall",
					"ROC & AUC",
					"Bias vs variance",
				],
			},
			{
				title: "Feature Engineering",
				summary:
					"Data scientists' secret weapon: scaling, encoding categories, handling missing values, building new features and choosing the ones that matter.",
				topics: [
					"Scaling & encoding",
					"Missing values",
					"Crafting features",
					"Feature selection",
				],
			},
			{
				title: "Clustering",
				summary:
					"Finding groups nobody labelled: k-means, hierarchical trees of clusters, density-based DBSCAN and soft clusters with Gaussian mixtures.",
				topics: [
					"k-means",
					"Hierarchical clustering",
					"DBSCAN",
					"Gaussian mixtures",
				],
			},
			{
				title: "Dimensionality Reduction",
				summary:
					"Squeezing many features into a few: PCA's directions of greatest spread, and t-SNE and UMAP for maps you can see.",
				topics: [
					"Why fewer dimensions",
					"PCA",
					"Explained variance",
					"t-SNE & UMAP",
				],
			},
		],
	},
	{
		id: "deep-learning",
		name: "Deep Learning",
		short: "DL",
		blurb:
			"Neural networks, from a single neuron to the architectures behind modern vision, sequence and generative models.",
		lectures: [
			{
				title: "The Perceptron & the Neuron",
				summary:
					"Where it all started: weighted sums, activation functions, the perceptron learning rule and the XOR problem that stalled the field.",
				topics: [
					"A neuron, in maths",
					"Activation functions",
					"The perceptron rule",
					"The XOR wall",
				],
			},
			{
				title: "Neural Networks & Backpropagation",
				summary:
					"Stacking neurons into layers, the forward pass, and backpropagation — the chain rule that lets millions of weights learn at once.",
				topics: [
					"Layers & the forward pass",
					"Loss functions",
					"The chain rule",
					"Backprop, step by step",
				],
			},
			{
				title: "Training Deep Networks",
				summary:
					"Making deep nets actually learn: SGD, momentum and Adam, learning-rate schedules, initialisation, batch normalisation and dropout.",
				topics: [
					"SGD, momentum, Adam",
					"Learning rates",
					"Initialisation",
					"BatchNorm & dropout",
				],
			},
			{
				title: "Convolutional Neural Networks",
				summary:
					"How machines see: convolution filters, feature maps, pooling, and the architectures from LeNet to ResNet.",
				topics: [
					"Convolution, visualised",
					"Feature maps & pooling",
					"Classic architectures",
					"Residual connections",
				],
			},
			{
				title: "Recurrent Networks & LSTMs",
				summary:
					"Networks with memory: recurrence over sequences, vanishing gradients, and the gates of LSTMs and GRUs.",
				topics: [
					"Unrolling through time",
					"Vanishing gradients",
					"LSTM gates",
					"GRUs",
				],
			},
			{
				title: "Attention & Transformers",
				summary:
					"Letting every word look at every other: queries, keys and values, multi-head attention, positional encoding and the full transformer block.",
				topics: [
					"Why attention",
					"Queries, keys, values",
					"Multi-head attention",
					"The transformer block",
				],
			},
			{
				title: "Autoencoders & VAEs",
				summary:
					"Compress, then rebuild: encoders and decoders, latent spaces, and variational autoencoders that can dream up new examples.",
				topics: [
					"Encode → decode",
					"Latent spaces",
					"The VAE trick",
					"Generating samples",
				],
			},
			{
				title: "GANs & Diffusion Models",
				summary:
					"Two ways to create images: a forger and a detective locked in a game, and diffusion models that learn to remove noise step by step.",
				topics: [
					"Generator vs discriminator",
					"Training instability",
					"Adding & removing noise",
					"Guided generation",
				],
			},
			{
				title: "Transfer Learning",
				summary:
					"Standing on a pretrained network's shoulders: feature extraction, fine-tuning, and why it works with little data.",
				topics: [
					"Pretrained features",
					"Freeze or fine-tune",
					"Domain shift",
					"Small-data wins",
				],
			},
		],
	},
	{
		id: "reinforcement-learning",
		name: "Reinforcement Learning",
		short: "RL",
		blurb:
			"Agents that learn by trial and error from rewards: Markov decision processes, value functions, policies — and scaling them with deep networks.",
		lectures: [
			{
				title: "Reinforcement Learning",
				summary:
					"From trial-and-error to optimal control: the agent-environment loop, bandits, MDPs, Bellman equations, Q-learning and SARSA — a gridworld traced by hand, live playgrounds for every formula, and the road to deep RL and RLHF. Slides and PDF notes included.",
				topics: [
					"MDPs",
					"Bellman equations",
					"Q-learning & SARSA",
					"Exploration",
					"Deep RL & RLHF",
				],
				href: "/lectures/reinforcement-learning/",
				length: "~30 min",
				index: [
					["why", "No labels, only consequences"],
					["loop", "Act · observe · repeat"],
					["bandits", "The slot-machine dilemma"],
					["mdp", "Giving the world a state"],
					["return", "Why tomorrow's reward shrinks"],
					["bellman", "Bellman's recursive promise"],
					["solving", "Plan, replay or bootstrap"],
					["control", "SARSA the cautious, Q the bold"],
					["playground", "Your hands on the controls"],
					["beyond", "When tables die: deep RL → RLHF"],
					["summary", "Six lines to remember"],
				],
			},
			{
				title: "Deep Q-Networks",
				summary:
					"When the table is too big: approximating Q with a neural network, experience replay, target networks and the Atari breakthrough.",
				topics: [
					"Function approximation",
					"Experience replay",
					"Target networks",
					"Double DQN",
				],
			},
			{
				title: "Policy Gradients & Actor–Critic",
				summary:
					"Learning the policy directly: REINFORCE, baselines to cut variance, actor–critic methods and PPO, the workhorse behind RLHF.",
				topics: ["REINFORCE", "Baselines & advantage", "Actor–critic", "PPO"],
			},
		],
	},
	{
		id: "large-language-models",
		name: "Large Language Models",
		short: "LLM",
		blurb:
			"How modern language models are built and used: tokens and embeddings, transformers at scale, alignment, prompting and retrieval.",
		lectures: [
			{
				title: "Language Modelling",
				summary:
					"Predicting the next word: n-gram models, probability of a sentence, perplexity, and why next-token prediction turns out to be so powerful.",
				topics: [
					"Next-word prediction",
					"n-gram models",
					"Perplexity",
					"From counts to networks",
				],
			},
			{
				title: "Tokens & Embeddings",
				summary:
					"Turning text into numbers: tokenisation with BPE, word embeddings, and the geometry where king − man + woman ≈ queen.",
				topics: [
					"Tokenisation & BPE",
					"Word embeddings",
					"Meaning as geometry",
					"Contextual embeddings",
				],
			},
			{
				title: "The Transformer, Inside an LLM",
				summary:
					"Following one token through a GPT-style model: embeddings, masked self-attention, MLP blocks, residual streams and the output distribution.",
				topics: [
					"Decoder-only models",
					"Masked self-attention",
					"The residual stream",
					"Logits to words",
				],
			},
			{
				title: "Pre-training at Scale",
				summary:
					"Reading the internet: training data, the next-token objective at scale, compute and scaling laws, and the abilities that emerge.",
				topics: [
					"Data at scale",
					"Scaling laws",
					"Compute budgets",
					"Emergent abilities",
				],
			},
			{
				title: "Decoding & Sampling",
				summary:
					"From probabilities to text: greedy decoding, beam search, temperature, top-k and top-p sampling — and how each changes what the model writes.",
				topics: [
					"Greedy & beam search",
					"Temperature",
					"Top-k & top-p",
					"Repetition & creativity",
				],
			},
			{
				title: "Fine-tuning & LoRA",
				summary:
					"Teaching a pretrained model new tricks: supervised fine-tuning, instruction tuning, and parameter-efficient methods like LoRA.",
				topics: [
					"Supervised fine-tuning",
					"Instruction tuning",
					"LoRA & adapters",
					"Catastrophic forgetting",
				],
			},
			{
				title: "Alignment: RLHF & DPO",
				summary:
					"Making models helpful and harmless: preference data, reward models, RLHF with PPO, and the simpler direct preference optimisation.",
				topics: ["Human preferences", "Reward models", "RLHF with PPO", "DPO"],
			},
			{
				title: "Prompting & In-Context Learning",
				summary:
					"Programming with words: zero- and few-shot prompting, chain-of-thought reasoning, and why examples in the prompt teach without training.",
				topics: [
					"Zero & few-shot",
					"Chain of thought",
					"Prompt patterns",
					"In-context learning",
				],
			},
			{
				title: "Retrieval-Augmented Generation",
				summary:
					"Giving a model an open book: chunking and embedding documents, vector search, re-ranking, and grounding answers in sources.",
				topics: [
					"Chunk & embed",
					"Vector search",
					"Re-ranking",
					"Grounded answers",
				],
			},
			{
				title: "Evaluating LLMs",
				summary:
					"Measuring what a model can do: benchmarks, human and model-graded evaluation, hallucination, and red-teaming for safety.",
				topics: ["Benchmarks", "LLM-as-judge", "Hallucination", "Red-teaming"],
			},
		],
	},
	{
		id: "ai-agents",
		name: "AI Agents",
		short: "AGT",
		blurb:
			"Language models that act: using tools, reasoning step by step, remembering, working in teams — and doing it safely.",
		lectures: [
			{
				title: "What Is an AI Agent?",
				summary:
					"From chatbot to actor: the perceive–reason–act loop, the LLM as a controller, autonomy levels, and where agents help or hurt.",
				topics: [
					"The agent loop",
					"LLM as controller",
					"Levels of autonomy",
					"When to use agents",
				],
			},
			{
				title: "Tool Use & Function Calling",
				summary:
					"Giving a model hands: tool schemas, function calling, parsing results, and connecting to the world through APIs and MCP.",
				topics: [
					"Tool schemas",
					"Function calling",
					"Handling results",
					"MCP & APIs",
				],
			},
			{
				title: "Reasoning & Planning",
				summary:
					"Thinking before acting: ReAct's thought–action–observation loop, task decomposition, planning, and self-reflection to fix mistakes.",
				topics: [
					"ReAct",
					"Task decomposition",
					"Plan-and-execute",
					"Reflection",
				],
			},
			{
				title: "Memory for Agents",
				summary:
					"Remembering across steps and sessions: context windows, summarisation, long-term memory in vector stores, and what to forget.",
				topics: [
					"Context as memory",
					"Summarisation",
					"Vector-store memory",
					"Forgetting on purpose",
				],
			},
			{
				title: "Multi-Agent Systems",
				summary:
					"Agents working together: orchestrators and workers, debate and critique, hand-offs, and when one agent is better than many.",
				topics: [
					"Orchestrator & workers",
					"Debate & critique",
					"Hand-offs",
					"Coordination costs",
				],
			},
			{
				title: "Agent Safety & Evaluation",
				summary:
					"Keeping agents trustworthy: prompt injection, sandboxing and permissions, human-in-the-loop checks, and measuring agent success.",
				topics: [
					"Prompt injection",
					"Sandboxes & permissions",
					"Human in the loop",
					"Evaluating agents",
				],
			},
			{
				title: "Project: Build an Agent",
				summary:
					"Putting it all together: a research assistant that plans, searches, uses tools, remembers and cites — built and tested step by step.",
				topics: ["Design the loop", "Add tools", "Add memory", "Test & harden"],
			},
		],
	},
];
