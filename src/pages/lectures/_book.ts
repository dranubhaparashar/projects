// The lecture book: parts (tracks) and their chapters, in reading order.
// A chapter with an `href` is live; one without shows as "Coming soon".
// `index` lists a live lecture's section anchors with their index labels.

export type Lecture = {
	num: string;
	title: string;
	summary: string;
	topics: string[];
	href?: string;
	length?: string;
	index?: [string, string][];
	slug?: string;
};

export type Track = {
	part: number;
	id: string;
	name: string;
	short: string;
	blurb: string;
	lectures: Lecture[];
};

export const tracks: Track[] = [
	{
		part: 0,
		id: "foundations",
		name: "Foundations: AI, Maths & Probability",
		short: "FND",
		blurb:
			"What AI is and where it came from, then the maths every later part leans on: linear algebra, calculus and optimisation, probability, estimation, information theory and Bayesian inference.",
		lectures: [
			{
				num: "0.1",
				title: "What Is AI? Four Definitions and Seventy Years of History",
				summary:
					"Sort eight textbook definitions into the four quadrants, play the Turing test as a signal-detection game, model the taxicab base-rate mistake, check syllogisms by enumerating possible worlds, watch a rational robot obey a mis-specified objective, try working models from AI's eight parent fields (induction, tractability, St Petersburg, a spiking neuron, Hick's law, Moore's law, a thermostat, Catalan-many parses), wire McCulloch–Pitts gates, hit the combinatorial explosion, combine MYCIN certainty factors, race learners on growing data and fit the ImageNet trend, then explore seventy years of AI people and systems from Wikidata.",
				topics: [
					"Acting humanly, thinking humanly",
					"The fields AI borrows from",
					"1943-1969",
					"The dose of reality, expert systems and",
				],
				href: "/lectures/what-is-ai/",
				length: "~40 min",
				index: [
					["four", "Four ways to define AI"],
					["turing", "The Turing test"],
					["think", "Thinking like us, thinking right"],
					["rational", "Rational agents and their objectives"],
					["roots", "Eight parent fields"],
					["birth", "1943–1969: birth and big hopes"],
					["winter", "Reality, expert systems, winters"],
					["return", "Nets, probability and big data"],
					["deep", "Deep learning and today"],
					["project", "Seventy years in Wikidata"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.2",
				title: "Linear Algebra for Machine Learning",
				summary:
					"Read a real photograph as a matrix of grey levels, drag column arrows to watch a matrix map the plane, step Gaussian elimination through three equations, line vectors up to lose rank, compare L1, L2 and max-norm balls, turn x round the circle until it lines up with Ax, play the SVD's turn-stretch-turn, flatten a square to a zero determinant, and rebuild the 1903 first-flight photograph from k singular-value layers.",
				topics: [
					"Scalars, vectors, matrices and tensors",
					"Identity, inverse, linear dependence and",
					"Norms",
					"Special matrices",
				],
				href: "/lectures/linear-algebra/",
				length: "~40 min",
				index: [
					["objects", "Numbers on 0, 1, 2 or more axes"],
					["maps", "A matrix is a map"],
					["inverse", "Undoing it: inverses and elimination"],
					["span", "Span, dependence and rank"],
					["norms", "Norms: how big is a vector?"],
					["special", "Diagonal, symmetric, orthogonal"],
					["eigen", "Eigenvectors: directions that only stretch"],
					["svd", "SVD: turn, stretch, turn"],
					["volume", "Trace and determinant as area"],
					["project", "The first flight in k layers"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.3",
				title: "Matrix Calculus, Numerics & Constraints",
				summary:
					"Slide along a constraint until the gradients line up, warp grids to watch Jacobians scale area, take gradient and Newton steps on saddles and stretched bowls, check matrix derivatives with finite differences, break a naive softmax in float32, drain a Hilbert solve of its digits, price constraints with Lagrange and KKT multipliers, race a bead down a brachistochrone, and solve for maximum-entropy densities.",
				topics: [
					"Gradients, Jacobians and Hessians",
					"Traces, determinants and their derivatives",
					"Overflow, underflow and the log-sum-exp",
					"Poor conditioning and the condition number",
				],
				href: "/lectures/calculus-numerics-optimisation/",
				length: "~50 min",
				index: [
					["grad", "Gradients & Jacobians"],
					["hessian", "Curvature: the Hessian"],
					["identities", "Matrix identities & derivatives"],
					["trace", "Traces & determinants"],
					["overflow", "Overflow & log-sum-exp"],
					["conditioning", "Poor conditioning"],
					["lagrange", "Lagrange multipliers"],
					["kkt", "Inequalities & KKT"],
					["variations", "Optimising over functions"],
					["project", "A maximum-entropy diet"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.4",
				title: "Probability: Degrees of Belief, Rules & Counting",
				summary:
					"Condition 1,000 patients by clicking symptom blocks, pick the leaving time that maximises expected utility for a flight, build events on two fair and loaded dice, get Dutch-booked for incoherent beliefs, watch the sum and product rules hold in a diary of counts, answer queries by enumerating a full joint table, break conditional independence with a slider, see base rates sink a good test, and step through the Wumpus caves on exact pit probabilities, then query a 720-cell joint table of the real Adult census by counting.",
				topics: [
					"Why probability",
					"Propositions, events and the axioms",
					"Sum and product rules",
					"Inference from a full joint distribution",
				],
				href: "/lectures/probability-rules/",
				length: "~35 min",
				index: [
					["why", "Acting under uncertainty"],
					["events", "Worlds, events, variables"],
					["axioms", "The axioms and the Dutch book"],
					["rules", "Sum and product rules"],
					["joint", "Inference by enumeration"],
					["indep", "Independence"],
					["bayes", "Bayes' rule"],
					["wumpus", "The Wumpus world"],
					["project", "A census you can query"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.5",
				title: "Random Variables, Expectations & Distributions",
				summary:
					"Pour samples into histograms that settle onto their curves, move an interval to read probabilities from bars, areas and the CDF, push densities through x², −ln(1−x) and the logit to see why the Jacobian matters, watch Monte Carlo averages fall into their 1/√N funnel, drag points to make covariance vanish under a parabola, toss coins and load a die, slide along uniform, exponential (memoryless) and Laplace shapes, shrink kernel bumps into Dirac spikes, drag mixture peaks to read responsibilities, and check every sigmoid–softplus identity live.",
				topics: [
					"Discrete and continuous variables",
					"Change of variables and the technical",
					"Expectation, variance and covariance",
					"Bernoulli, binomial, multinomial and",
				],
				href: "/lectures/random-variables-distributions/",
				length: "~40 min",
				index: [
					["rv", "Mass, density and the CDF"],
					["change", "Change of variables"],
					["expect", "Expectation, variance, covariance"],
					["binary", "Bernoulli and binomial"],
					["multi", "Multinoulli and multinomial"],
					["shapes", "Uniform, exponential, Laplace"],
					["empirical", "Dirac and the empirical distribution"],
					["mix", "Mixtures of distributions"],
					["funcs", "Sigmoid and softplus"],
					["project", "Waiting for the next earthquake"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.6",
				title: "The Multivariate Gaussian",
				summary:
					"Slice and reshape a live Gaussian cloud, drag points to feel Mahalanobis distance, rotate a cloud into its eigen-axes and whiten it, draw thousands of samples to watch the ML variance fall short by (N−1)/N, check conditional and marginal formulas against 6,000 counted points, fuse a prior with a GPS or east-only sensor, and watch averages turn into bells, before predicting children's heights from Galton's 205 families.",
				topics: [
					"From one dimension to many",
					"Maximum likelihood for mean and",
					"Conditional Gaussians",
					"Marginal Gaussians",
				],
				href: "/lectures/multivariate-gaussian/",
				length: "~40 min",
				index: [
					["one", "The bell in one dimension"],
					["density", "Ellipses and Mahalanobis distance"],
					["eigen", "The cloud's own axes"],
					["mle", "Fitting it, and the biased variance"],
					["cond", "Slicing: conditionals"],
					["marg", "Projecting: marginals"],
					["bayes", "Bayes for linear-Gaussian models"],
					["everywhere", "Why the bell is everywhere"],
					["project", "Galton's families"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.7",
				title: "Estimators, Maximum Likelihood & MAP",
				summary:
					"Reveal real Fremont Bridge cyclist counts one day at a time and watch the MLE and MAP close in on the truth. Along the way you race four estimators, slide the variance divisor to find the lowest MSE, watch coin-flippers converge, drag data under a Gaussian to climb the likelihood map, match a Poisson to night-time counts by cross-entropy, derive MSE and cross-entropy from conditional likelihood, meet the Cramér–Rao bound, see losses learn means, medians and quantiles, and tame a degree-9 polynomial with a prior.",
				topics: [
					"Point estimators, bias, variance and mean",
					"Consistency and why more data helps",
					"Maximum likelihood as minimising KL to",
					"Conditional log-likelihood",
				],
				href: "/lectures/estimation-maximum-likelihood/",
				length: "~40 min",
				index: [
					["estimators", "An estimator is a repeatable guess"],
					["bias", "Bias, variance and MSE"],
					["consistency", "Consistency: more data helps"],
					["mle", "Maximum likelihood"],
					["kl", "MLE as matching the data"],
					["conditional", "Where MSE and cross-entropy come from"],
					["properties", "Efficiency and Cramér–Rao"],
					["outputs", "Output units learn statistics"],
					["map", "Priors as regularisers"],
					["project", "Cyclists on the Fremont Bridge"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.8",
				title: "Information Theory: Entropy, KL & Mutual Information",
				summary:
					"Watch a model of English price every letter you type in bits, reshape distributions to see entropy rise and fall, count arrangements of balls until (1/N) ln W meets H, grow Huffman trees and block codes, shrink bins to find differential entropy and the maximum-entropy Gaussian, drag points along a curve to see Jensen's inequality, fit one Gaussian to two humps with forward and reverse KL, train softmax scores on cross-entropy, and measure the mutual information between the weather and an umbrella.",
				topics: [
					"Information as surprise",
					"Differential entropy and the",
					"Cross-entropy and why it is the",
					"KL divergence and Jensen's inequality",
				],
				href: "/lectures/information-theory/",
				length: "~40 min",
				index: [
					["surprise", "Information is surprise"],
					["entropy", "Entropy: the average surprise"],
					["count", "Counting arrangements"],
					["coding", "Codes: compression is prediction"],
					["continuous", "Differential entropy & the Gaussian"],
					["kl", "KL divergence & Jensen"],
					["asym", "Forward vs reverse KL"],
					["cross", "Cross-entropy: the classification loss"],
					["mutual", "Conditional entropy & mutual information"],
					["project", "The information in a novel"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.9",
				title: "Bayesian Inference & Conjugate Priors",
				summary:
					"Toss a hidden coin and watch a Beta posterior close in, multiply priors by likelihoods on a grid, update Beta, Dirichlet, Gaussian, Gamma and Normal-Gamma beliefs by adding counts, see add-k smoothing fall out of the predictive, test whether \"flat\" priors really are flat, race Bayes against MAP and ML on bags of sweets, draw whole curves from a posterior, and shrink real click-through rates from the Open Bandit Dataset.",
				topics: [
					"Prior, likelihood, posterior and the",
					"Beta-Bernoulli",
					"Dirichlet-multinomial and where add-k",
					"Gaussian with unknown mean and precision",
				],
				href: "/lectures/bayesian-inference/",
				length: "~45 min",
				index: [
					["why", "Bayes' rule for a parameter"],
					["beta", "Updating a coin, toss by toss"],
					["predict", "Predicting the next toss"],
					["dirichlet", "Dirichlet and add-k smoothing"],
					["gauss", "A Gaussian's unknown mean"],
					["precision", "Gamma and Normal-Gamma priors"],
					["conjugate", "Conjugate and flat priors"],
					["learn", "Bayes vs MAP vs ML"],
					["curves", "A posterior over curves"],
					["project", "Click rates that don't overreact"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "0.10",
				title: "Beyond the Gaussian: t, von Mises, Gamma & Wishart",
				summary:
					"Drag an outlier past a Gaussian and a Student's t, compare quadratic and logarithmic penalties, watch a Gaussian-Gamma posterior close in on the truth, build the t from a crowd of random-precision Gaussians, step EM to a robust 2-D fit, average angles on a circle, derive the von Mises from a 2-D Gaussian, sample Wishart precision matrices, and let AIC choose a likelihood, then fit a year of real Boston wind.",
				topics: [
					"Student's t as an infinite mixture of",
					"Robustness to outliers",
					"Periodic data and the von Mises",
					"Gamma and Wishart as priors over",
				],
				href: "/lectures/beyond-the-gaussian/",
				length: "~35 min",
				index: [
					["why", "Where the bell curve breaks"],
					["precision", "Gamma: priors over precision"],
					["student", "Student's t: a crowd of Gaussians"],
					["robust", "Robust fits by EM"],
					["circle", "Angles and the circular mean"],
					["vonmises", "The von Mises distribution"],
					["wishart", "Wishart and Gaussian-Wishart"],
					["choose", "Choosing a likelihood"],
					["project", "A year of Boston wind"],
					["summary", "Five lines to remember"],
				],
			},
		],
	},
	{
		part: 1,
		id: "machine-learning",
		name: "Machine Learning",
		short: "ML",
		blurb:
			"Classical models that learn from data: the paradigms, regression and classification, evaluation, and finding structure without labels.",
		lectures: [
			{
				num: "1.1",
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
				num: "1.2",
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
				num: "1.2a",
				title: "Choosing Inputs: Subset Selection, PCR & Partial Least Squares",
				summary:
					"Best-subset selection and why it explodes; Forward and backward stepwise, forward stagewise; Principal components regression; Partial least squares.",
				topics: [
					"Best-subset selection and why it explodes",
					"Forward and backward stepwise, forward",
					"Principal components regression",
					"Partial least squares",
				],
				slug: "subset-selection-derived-inputs",
			},
			{
				num: "1.2b",
				title: "Sparse Models: Lasso Paths, LARS & the Group Lasso",
				summary:
					"Least angle regression and the piecewise-linear path; Incremental forward stagewise and its link to boosting; Pathwise coordinate descent; The Dantzig selector, grouped lasso and further lasso properties.",
				topics: [
					"Least angle regression and the",
					"Incremental forward stagewise and its",
					"Pathwise coordinate descent",
					"The Dantzig selector, grouped lasso and",
				],
				slug: "lasso-paths",
			},
			{
				num: "1.2c",
				title: "Inference for Linear Models: Standard Errors, Tests & Gauss-Markov",
				summary:
					"Sampling distribution of least squares; standard errors and t-tests; F-tests for dropping groups of variables; The Gauss-Markov theorem; Multiple regression as successive orthogonalisation.",
				topics: [
					"Sampling distribution of least squares",
					"F-tests for dropping groups of variables",
					"The Gauss-Markov theorem",
					"Multiple regression as successive",
				],
				slug: "linear-model-inference",
			},
			{
				num: "1.2d",
				title: "Bayesian Linear Regression",
				summary:
					"A Gaussian prior over the weights; The posterior, updated one point at a time; The predictive distribution and its error bars; Bayesian curve fitting revisited.",
				topics: [
					"A Gaussian prior over the weights",
					"The posterior, updated one point at a time",
					"The predictive distribution and its error",
					"Bayesian curve fitting revisited",
				],
				slug: "bayesian-linear-regression",
			},
			{
				num: "1.2e",
				title: "Bayesian Model Comparison & the Evidence Approximation",
				summary:
					"Model evidence and the Occam factor; Comparing models by marginal likelihood; Evaluating the evidence function; Empirical Bayes: maximising over hyperparameters.",
				topics: [
					"Model evidence and the Occam factor",
					"Comparing models by marginal likelihood",
					"Evaluating the evidence function",
					"Empirical Bayes",
				],
				slug: "bayesian-model-evidence",
			},
			{
				num: "1.3",
				title: "Logistic Regression",
				summary:
					"Turning a line into a probability: the sigmoid, odds and odds ratios, why log-loss beats squared error, a gradient step by hand, decision boundaries and softmax — then a Titanic survival project with live thresholds, ROC curves and a find-a-passenger lab.",
				topics: [
					"The sigmoid squash",
					"Odds & log-odds",
					"Log-loss",
					"Decision threshold & ROC",
					"Softmax for many classes",
				],
				href: "/lectures/logistic-regression/",
				length: "~25 min",
				index: [
					["why", "Yes or no needs a new line"],
					["sigmoid", "The S-curve that squashes"],
					["odds", "Odds: the hidden straight line"],
					["loss", "Punishing confident mistakes"],
					["train", "Downhill on the log-loss bowl"],
					["boundary", "A straight cut between classes"],
					["softmax", "Softmax: more than two answers"],
					["project", "Who survived the Titanic?"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.3a",
				title: "The Exponential Family & Generalised Linear Models",
				summary:
					"The exponential family and its natural parameters; Sufficient statistics and maximum likelihood; Canonical link functions: one recipe for linear, logistic and Poisson; Newton's method and iteratively reweighted least squares.",
				topics: [
					"The exponential family and its natural",
					"Sufficient statistics and maximum",
					"Canonical link functions",
					"Newton's method and iteratively",
				],
				slug: "glms-exponential-family",
			},
			{
				num: "1.3b",
				title: "The Laplace Approximation & Bayesian Logistic Regression",
				summary:
					"Approximating a posterior by a Gaussian at its mode; Model comparison and the BIC derived; Bayesian logistic regression: the posterior; The predictive distribution and the probit approximation.",
				topics: [
					"Approximating a posterior by a Gaussian",
					"Model comparison and the BIC derived",
					"Bayesian logistic regression",
					"The predictive distribution and the",
				],
				slug: "laplace-bayesian-logistic",
			},
			{
				num: "1.4",
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
				num: "1.4a",
				title: "Basis Expansions: Piecewise Polynomials, Splines & Wavelets",
				summary:
					"Basis functions and dictionary methods; Piecewise polynomials and regression splines; Natural cubic splines and B-splines; Filtering and feature extraction (the phoneme example).",
				topics: [
					"Basis functions and dictionary methods",
					"Piecewise polynomials and regression",
					"Natural cubic splines and B-splines",
					"Filtering and feature extraction",
				],
				slug: "splines-wavelets",
			},
			{
				num: "1.4b",
				title: "Smoothing Splines & Reproducing Kernel Hilbert Spaces",
				summary:
					"Roughness penalties and the smoothing spline; Degrees of freedom and smoother matrices; Choosing lambda automatically; Nonparametric logistic regression and multidimensional splines.",
				topics: [
					"Roughness penalties and the smoothing",
					"Degrees of freedom and smoother matrices",
					"Choosing lambda automatically",
					"Nonparametric logistic regression and",
				],
				slug: "smoothing-splines-rkhs",
			},
			{
				num: "1.5",
				title: "Naive Bayes",
				summary:
					"The 'wrong' assumption that works: Bayes' rule by counting, treating features as independent, catching spam by counting words, smoothing away the zero-probability trap, logs against underflow, Gaussian NB vs QDA — and a real SMS spam filter trained in your browser.",
				topics: [
					"Independence, naively",
					"Spam by word counts",
					"Laplace smoothing",
					"Gaussian vs multinomial",
				],
				href: "/lectures/naive-bayes/",
				length: "~25 min",
				index: [
					["why", "The “naive” bet that works"],
					["bayes", "Bayes’ rule, counted out"],
					["naive", "Pretending features don’t talk"],
					["words", "Catching spam by counting words"],
					["smooth", "The zero-probability trap"],
					["logs", "Adding logs, not multiplying"],
					["gaussian", "Gaussian NB for numbers"],
					["project", "A real SMS spam filter"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.6",
				title: "k-Nearest Neighbours",
				summary:
					"Judging by the company you keep: the neighbour vote, three distances, choosing k by cross-validation, why scaling matters, how high dimensions make everyone a stranger — and a draw-a-digit project where you meet the neighbours who read your handwriting.",
				topics: [
					"Distance, three ways",
					"Choosing k",
					"Feature scaling",
					"Curse of dimensionality",
				],
				href: "/lectures/k-nearest-neighbours/",
				length: "~25 min",
				index: [
					["why", "Judged by the company you keep"],
					["vote", "Ask your k nearest neighbours"],
					["distance", "Distance, three ways"],
					["k", "Choosing k: from nervous to numb"],
					["scaling", "Why scaling matters"],
					["curse", "The curse of dimensionality"],
					["regression", "k-NN for numbers too"],
					["project", "Reading handwriting with neighbours"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.6a",
				title: "Kernel Smoothing & Local Regression",
				summary:
					"Nadaraya-Watson: a weighted average of neighbours; Local linear and local polynomial regression; Choosing the kernel width; Local regression in many dimensions and structured kernels.",
				topics: [
					"Nadaraya-Watson",
					"Local linear and local polynomial",
					"Choosing the kernel width",
					"Local regression in many dimensions and",
				],
				slug: "kernel-smoothing",
			},
			{
				num: "1.6b",
				title: "Density Estimation: Histograms, Kernels & RBF Networks",
				summary:
					"Histograms and the bin-width problem; Kernel density estimators; k-NN density estimation and the Bayes classifier it implies; Kernel density classification.",
				topics: [
					"Histograms and the bin-width problem",
					"Kernel density estimators",
					"k-NN density estimation and the Bayes",
					"Kernel density classification",
				],
				slug: "density-estimation",
			},
			{
				num: "1.6c",
				title: "Prototype Methods & Adaptive Nearest Neighbours",
				summary:
					"Prototypes: k-means as a classifier; Learning vector quantisation; Invariant metrics and tangent distance; Adaptive (DANN) nearest neighbours.",
				topics: [
					"Prototypes",
					"Learning vector quantisation",
					"Invariant metrics and tangent distance",
					"Adaptive nearest neighbours",
				],
				slug: "prototypes-adaptive-nn",
			},
			{
				num: "1.7",
				title: "Decision Trees",
				summary:
					"Twenty questions, learned from data: one split at a time, Gini and entropy, information gain by hand, growing a tree split by split, pruning it before it memorises, regression trees — and a Palmer Penguins project that prints its rules in plain words.",
				topics: [
					"Entropy & Gini",
					"Information gain",
					"Growing a tree",
					"Pruning",
				],
				href: "/lectures/decision-trees/",
				length: "~25 min",
				index: [
					["why", "Twenty questions, learned from data"],
					["split", "One question at a time"],
					["impurity", "Gini vs entropy: measuring a mess"],
					["gain", "Information gain, by hand"],
					["grow", "Growing a tree, split by split"],
					["prune", "Pruning before it memorises"],
					["regression", "Trees for numbers"],
					["project", "Telling penguins apart"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.7a",
				title: "Generalised Additive Models, PRIM & MARS",
				summary:
					"Additive models and backfitting; Additive logistic regression; PRIM: bump hunting for high-response boxes; MARS: hinge functions and forward selection.",
				topics: [
					"Additive models and backfitting",
					"Additive logistic regression",
					"PRIM",
					"MARS",
				],
				slug: "additive-models-mars",
			},
			{
				num: "1.8",
				title: "Ensembles: Forests & Boosting",
				summary:
					"Many weak voters beat one expert: the wisdom of crowds, bagging and bootstrap samples, random forests and out-of-bag error, AdaBoost's focus on mistakes, gradient boosting on residuals — and a California housing race with a live price map.",
				topics: [
					"Wisdom of crowds",
					"Bagging & random forests",
					"AdaBoost",
					"Gradient boosting",
				],
				href: "/lectures/ensembles/",
				length: "~30 min",
				index: [
					["why", "The wisdom of crowds"],
					["bagging", "Bagging: many trees, different views"],
					["forest", "Random forests: decorrelating the trees"],
					["oob", "Out-of-bag: a test set for free"],
					["adaboost", "AdaBoost: learning from mistakes"],
					["gboost", "Gradient boosting: fitting the residuals"],
					["zoo", "Bias, variance and the ensemble zoo"],
					["project", "Pricing California homes"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.8a",
				title: "Boosting as Additive Modelling: Exponential Loss & Robust Losses",
				summary:
					"Boosting fits an additive model; Forward stagewise additive modelling; AdaBoost is exponential-loss minimisation; Why exponential loss? Its population minimiser.",
				topics: [
					"Boosting fits an additive model",
					"Forward stagewise additive modelling",
					"AdaBoost is exponential-loss minimisation",
					"Why exponential loss? Its population",
				],
				slug: "boosting-additive-modelling",
			},
			{
				num: "1.8b",
				title: "Gradient Boosting in Practice: Trees, Shrinkage & Interpretation",
				summary:
					"Boosting trees and steepest descent in function space; Gradient boosting for any differentiable loss; Implementations: XGBoost, LightGBM and histogram splits; Right-sized trees and interaction order.",
				topics: [
					"Boosting trees and steepest descent in",
					"Gradient boosting for any differentiable",
					"Implementations",
					"Right-sized trees and interaction order",
				],
				slug: "gradient-boosting-practice",
			},
			{
				num: "1.8c",
				title: "Random Forests in Depth & Learning Ensembles",
				summary:
					"Model averaging, stacking and bumping; Bayesian model averaging versus committees; Random-forest details: variable importance and proximity plots; Do forests overfit? Variance, bias and adaptive nearest neighbours.",
				topics: [
					"Model averaging, stacking and bumping",
					"Bayesian model averaging versus committees",
					"Random-forest details",
					"Do forests overfit? Variance, bias and",
				],
				slug: "forests-ensemble-learning",
			},
			{
				num: "1.9",
				title: "Support Vector Machines",
				summary:
					"The widest street between two classes: steer your own line, remove points to find the support vectors, turn the C dial, lift data until a straight street appears, and catch forged banknotes with a live SVM solver.",
				topics: [
					"Maximum margin",
					"Support vectors",
					"Soft margin & C",
					"The kernel trick",
				],
				href: "/lectures/support-vector-machines/",
				length: "~30 min",
				index: [
					["why", "Which line would you trust?"],
					["support", "Support vectors: the few that matter"],
					["soft", "Soft margins and the C dial"],
					["hinge", "Hinge loss: the SVM as a loss"],
					["kernel", "The kernel trick: lift, then cut"],
					["rbf", "RBF kernels: similarity bumps"],
					["when", "When to reach for an SVM"],
					["project", "Catching forged banknotes"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.9a",
				title: "SVM Theory: the Dual, Valid Kernels, Paths & Regression",
				summary:
					"Dual representations and the kernel matrix; Constructing valid kernels; Computing the support vector classifier and SVM; SVMs and the curse of dimensionality; the regularisation path.",
				topics: [
					"Dual representations and the kernel matrix",
					"Constructing valid kernels",
					"Computing the support vector classifier",
					"SVMs and the curse of dimensionality",
				],
				slug: "svm-theory",
			},
			{
				num: "1.9b",
				title: "Gaussian Processes for Regression",
				summary:
					"Linear regression revisited as a distribution over functions; The GP prior and the kernel as covariance; GP regression: the posterior mean and variance; Learning the hyperparameters by marginal likelihood.",
				topics: [
					"Linear regression revisited as a",
					"The GP prior and the kernel as covariance",
					"GP regression",
					"Learning the hyperparameters by marginal",
				],
				slug: "gaussian-processes",
			},
			{
				num: "1.9c",
				title: "GP Classification, ARD & the Relevance Vector Machine",
				summary:
					"Automatic relevance determination; Gaussian processes for classification; The Laplace approximation for GP classifiers; Relevance vector machine for regression.",
				topics: [
					"Automatic relevance determination",
					"Gaussian processes for classification",
					"The Laplace approximation for GP",
					"Relevance vector machine for regression",
				],
				slug: "gp-classification-rvm",
			},
			{
				num: "1.9d",
				title: "Flexible, Penalised & Mixture Discriminant Analysis",
				summary:
					"Generalising LDA: optimal scoring; Flexible discriminant analysis; Computing the FDA estimates; Penalised discriminant analysis.",
				topics: [
					"Generalising LDA",
					"Flexible discriminant analysis",
					"Computing the FDA estimates",
					"Penalised discriminant analysis",
				],
				slug: "flexible-discriminants",
			},
			{
				num: "1.10",
				title: "Evaluating Models",
				summary:
					"How to know a model is good before the world finds out: watch training error lie, see how much a small test set wobbles, cross-validate, read the confusion matrix, trade precision for recall, catch a leak that scores 90% on pure noise — and design a diabetes screening test with a sealed envelope.",
				topics: [
					"Honest splits",
					"Cross-validation",
					"Precision & recall",
					"ROC & AUC",
					"Bias vs variance",
				],
				href: "/lectures/evaluating-models/",
				length: "~35 min",
				index: [
					["why", "Training error lies"],
					["split", "Honest splits: train, validation, test"],
					["cv", "Cross-validation: everyone gets a turn"],
					["confusion", "The confusion matrix"],
					["pr", "Precision and recall"],
					["roc", "ROC curves and AUC"],
					["bv", "Bias and variance"],
					["leak", "Leakage: 90% accuracy on pure noise"],
					["project", "Designing a diabetes screening test"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.10a",
				title: "Model Selection Criteria: Optimism, Cp, AIC, BIC & MDL",
				summary:
					"The optimism of the training error; In-sample error estimates: Cp and AIC; The effective number of parameters; The Bayesian approach and BIC.",
				topics: [
					"The optimism of the training error",
					"In-sample error estimates",
					"The effective number of parameters",
					"The Bayesian approach and BIC",
				],
				slug: "model-selection-criteria",
			},
			{
				num: "1.10b",
				title: "Learning Theory: PAC, VC Dimension & Sample Complexity",
				summary:
					"PAC learning: probably approximately correct; Sample complexity for finite hypothesis classes; Learning decision lists; VC dimension and shattering.",
				topics: [
					"PAC learning",
					"Sample complexity for finite hypothesis",
					"Learning decision lists",
					"VC dimension and shattering",
				],
				slug: "learning-theory",
			},
			{
				num: "1.10c",
				title: "Likelihood Inference & the Bootstrap",
				summary:
					"The bootstrap: resampling the data you have; Bootstrap estimates of prediction error and .632; Maximum likelihood inference: Fisher information; Bootstrap versus maximum likelihood.",
				topics: [
					"The bootstrap",
					"Bootstrap estimates of prediction error",
					"Maximum likelihood inference",
					"Bootstrap versus maximum likelihood",
				],
				slug: "bootstrap-likelihood",
			},
			{
				num: "1.11",
				title: "Feature Engineering",
				summary:
					"Bend a straight line with hand-made columns on real bike-share data, watch gradient descent crawl in raw units, encode neighbourhoods, punch and fill holes, turn the Box–Cox dial, wrap hours round a circle, leak target encodings on pure noise, run forward selection — and climb a nine-step Ames housing pipeline cross-validated live.",
				topics: [
					"Scaling & encoding",
					"Missing values",
					"Crafting features",
					"Feature selection",
				],
				href: "/lectures/feature-engineering/",
				length: "~35 min",
				index: [
					["why", "The model sees only what you hand it"],
					["scale", "Scaling: one ruler for every feature"],
					["encode", "Encoding categories as numbers"],
					["missing", "Missing values: filling the holes"],
					["skew", "Taming skew with logs and powers"],
					["craft", "Crafting features from what you know"],
					["target", "Target encoding and the pipeline rule"],
					["select", "Feature selection: fewer, better inputs"],
					["project", "Pricing Ames houses, step by step"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.11a",
				title: "ML Systems in Practice: Formulation, Data, Explainability, Fairness & Monitoring",
				summary:
					"Problem formulation: what to predict and why; Data collection, assessment and management; Trust, interpretability and explainability (SHAP, LIME, counterfactuals); Fairness criteria and their trade-offs.",
				topics: [
					"Problem formulation",
					"Data collection, assessment and management",
					"Trust, interpretability and explainability",
					"Fairness criteria and their trade-offs",
				],
				slug: "ml-in-practice",
			},
			{
				num: "1.12",
				title: "Clustering",
				summary:
					"Drop your own centres and race k-means, step Lloyd's loop and EM by hand, run 100 random vs k-means++ starts, cut a live dendrogram, tune DBSCAN's ε, compare four algorithms by ARI — and segment 440 real wholesale customers.",
				topics: [
					"k-means",
					"Hierarchical clustering",
					"DBSCAN",
					"Gaussian mixtures",
				],
				href: "/lectures/clustering/",
				length: "~35 min",
				index: [
					["why", "Groups without an answer key"],
					["kmeans", "k-means: assign, update, repeat"],
					["init", "Bad starts and k-means++"],
					["choosek", "How many clusters?"],
					["hier", "A family tree of points"],
					["dbscan", "DBSCAN: clusters as crowds"],
					["gmm", "Gaussian mixtures: soft clusters"],
					["compare", "Four ideas, side by side"],
					["project", "Segmenting real customers"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.12a",
				title: "The EM Algorithm in General",
				summary:
					"Latent variables and the complete-data likelihood; EM as maximising a lower bound; Gaussian mixtures revisited; relation to k-means; Mixtures of Bernoulli distributions.",
				topics: [
					"Latent variables and the complete-data",
					"EM as maximising a lower bound",
					"Gaussian mixtures revisited",
					"Mixtures of Bernoulli distributions",
				],
				slug: "em-algorithm",
			},
			{
				num: "1.12b",
				title: "Dissimilarities, K-medoids & Self-Organising Maps",
				summary:
					"Proximity matrices and attribute dissimilarities; Object dissimilarity for mixed data; Combinatorial clustering algorithms; Vector quantisation.",
				topics: [
					"Proximity matrices and attribute",
					"Object dissimilarity for mixed data",
					"Combinatorial clustering algorithms",
					"Vector quantisation",
				],
				slug: "dissimilarities-kmedoids-som",
			},
			{
				num: "1.12c",
				title: "Association Rules & Market-Basket Analysis",
				summary:
					"Market-basket analysis: support, confidence, lift; The Apriori algorithm; Unsupervised learning as supervised learning; Generalised association rules.",
				topics: [
					"Market-basket analysis",
					"The Apriori algorithm",
					"Unsupervised learning as supervised",
					"Generalised association rules",
				],
				slug: "association-rules",
			},
			{
				num: "1.13",
				title: "Dimensionality Reduction",
				summary:
					"Turn a 3-D cloud until a hidden face appears, steer a projection, watch power iteration find PC1, compare explained variance on raw and standardised wine, rebuild doodles to catch anomalies, and run t-SNE and UMAP live — ending with eigenfaces and a map of 1,000 handwritten digits.",
				topics: [
					"Why fewer dimensions",
					"PCA",
					"Explained variance",
					"t-SNE & UMAP",
				],
				href: "/lectures/dimensionality-reduction/",
				length: "~35 min",
				index: [
					["why", "Many columns, few ideas"],
					["shadow", "Every view is a shadow"],
					["pca", "PCA: the covariance’s own axes"],
					["variance", "Explained variance: how many to keep?"],
					["recon", "Compress, rebuild, spot the odd one"],
					["curved", "When straight lines fail"],
					["tsne", "t-SNE: keep the neighbours close"],
					["umap", "UMAP: a graph, then a layout"],
					["project", "Eigenfaces and a map of handwriting"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "1.13a",
				title: "Probabilistic PCA & Factor Analysis",
				summary:
					"PCA as a latent-variable model; Maximum-likelihood PCA; EM for PCA; Bayesian PCA: choosing the dimension.",
				topics: [
					"PCA as a latent-variable model",
					"Maximum-likelihood PCA",
					"EM for PCA",
					"Bayesian PCA",
				],
				slug: "probabilistic-pca-factor-analysis",
			},
			{
				num: "1.13b",
				title: "Independent Component Analysis, Projection Pursuit & Slow Features",
				summary:
					"The cocktail-party problem; Why non-Gaussianity identifies sources; ICA by maximum likelihood and FastICA; Exploratory projection pursuit.",
				topics: [
					"The cocktail-party problem",
					"Why non-Gaussianity identifies sources",
					"ICA by maximum likelihood and FastICA",
					"Exploratory projection pursuit",
				],
				slug: "ica-projection-pursuit",
			},
			{
				num: "1.13c",
				title: "NMF, Archetypes & Sparse Coding",
				summary:
					"Non-negative matrix factorisation: parts-based representations; Archetypal analysis; Sparse representations and the L1 penalty; Sparse coding and dictionary learning.",
				topics: [
					"Non-negative matrix factorisation",
					"Archetypal analysis",
					"Sparse representations and the L1 penalty",
					"Sparse coding and dictionary learning",
				],
				slug: "nmf-sparse-coding",
			},
			{
				num: "1.13d",
				title: "Kernel PCA, Principal Curves, Sparse PCA & Spectral Clustering",
				summary:
					"Kernel PCA: PCA in feature space; Principal curves and surfaces; Spectral clustering via the graph Laplacian; Sparse principal components.",
				topics: [
					"Kernel PCA",
					"Principal curves and surfaces",
					"Spectral clustering via the graph",
					"Sparse principal components",
				],
				slug: "kernel-pca-spectral-clustering",
			},
			{
				num: "1.13e",
				title: "Multidimensional Scaling, Manifold Learning & PageRank",
				summary:
					"Classical, metric and non-metric MDS; Isomap, LLE and local MDS; Modelling nonlinear manifolds; The Google PageRank algorithm as an eigenvector.",
				topics: [
					"Classical, metric and non-metric MDS",
					"Isomap, LLE and local MDS",
					"Modelling nonlinear manifolds",
					"The Google PageRank algorithm as an",
				],
				slug: "manifold-learning-mds",
			},
			{
				num: "1.13f",
				title: "Recommender Systems: Collaborative Filtering & Matrix Factorisation",
				summary:
					"Users, items and the sparse ratings matrix; Neighbourhood collaborative filtering; Matrix factorisation by ALS and SGD; Implicit feedback.",
				topics: [
					"Users, items and the sparse ratings matrix",
					"Neighbourhood collaborative filtering",
					"Matrix factorisation by ALS and SGD",
					"Implicit feedback",
				],
				slug: "recommender-systems",
			},
			{
				num: "1.13g",
				title: "High-Dimensional Problems: When p >> N",
				summary:
					"Why p >> N changes everything; Diagonal LDA and nearest shrunken centroids; Quadratic regularisation: RDA, ridge-logistic, SVM; Feature selection and computational shortcuts.",
				topics: [
					"Why p >> N changes everything",
					"Diagonal LDA and nearest shrunken",
					"Quadratic regularisation",
					"Feature selection and computational",
				],
				slug: "high-dimensional-p-gg-n",
			},
			{
				num: "1.13h",
				title: "Supervised Principal Components & the False Discovery Rate",
				summary:
					"Supervised principal components; Connection to latent-variable models and PLS; Pre-conditioning for feature selection; Multiple testing: why p-values mislead.",
				topics: [
					"Supervised principal components",
					"Connection to latent-variable models and",
					"Pre-conditioning for feature selection",
					"Multiple testing",
				],
				slug: "supervised-pcs-fdr",
			},
		],
	},
	{
		part: 2,
		id: "deep-learning",
		name: "Deep Learning",
		short: "DL",
		blurb:
			"Neural networks, from a single neuron to the architectures behind modern vision, sequence and generative models.",
		lectures: [
			{
				num: "2.1",
				title: "The Perceptron & the Neuron",
				summary:
					"Watch a perceptron learn live, wire logic gates from one neuron, step through Rosenblatt's rule, check Novikoff's mistake bound across 200 random orders, hit the XOR wall and climb it with a hidden layer — then train a perceptron on real sonar echoes to tell mines from rocks.",
				topics: [
					"A neuron, in maths",
					"Activation functions",
					"The perceptron rule",
					"The XOR wall",
				],
				href: "/lectures/perceptron/",
				length: "~35 min",
				index: [
					["why", "One cell, one decision"],
					["gates", "Logic gates from a single neuron"],
					["activation", "Activation functions"],
					["rule", "Learning from mistakes"],
					["converge", "Why it must stop"],
					["xor", "The XOR wall"],
					["beyond", "Over the wall: lift or stack"],
					["project", "Mines or rocks? Sonar"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.2",
				title: "Neural Networks & Backpropagation",
				summary:
					"Fold the XOR plane into hidden space, click weights in a live 2-3-2 network, step through backprop with every gradient checked by nudging, train networks on rings and spirals, watch gradients vanish with depth — then train a 64-32-10 network on real handwritten digits and test it with your own drawings.",
				topics: [
					"Layers & the forward pass",
					"Loss functions",
					"The chain rule",
					"Backprop, step by step",
				],
				href: "/lectures/neural-networks/",
				length: "~35 min",
				index: [
					["why", "Bending space with a hidden layer"],
					["forward", "The forward pass, layer by layer"],
					["width", "Enough neurons make any curve"],
					["loss", "Loss: one number for how wrong"],
					["chain", "The chain rule passes the blame"],
					["backprop", "Backpropagation, step by step"],
					["train", "Train a network yourself"],
					["depth", "Deep chains, vanishing gradients"],
					["project", "Reading handwritten digits"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.2a",
				title: "Automatic Differentiation & Computational Graphs",
				summary:
					"Computational graphs; Forward and reverse mode; Symbol-to-symbol derivatives; General back-propagation.",
				topics: [
					"Computational graphs",
					"Forward and reverse mode",
					"Symbol-to-symbol derivatives",
					"General back-propagation",
				],
				slug: "automatic-differentiation",
			},
			{
				num: "2.2b",
				title: "PyTorch: Tensors, Autograd & the Training Loop",
				summary:
					"Tensors, dtypes and common operations; Models as computation graphs; Autograd in practice; Datasets and efficient data loaders.",
				topics: [
					"Tensors, dtypes and common operations",
					"Models as computation graphs",
					"Autograd in practice",
					"Datasets and efficient data loaders",
				],
				slug: "pytorch-training-loop",
			},
			{
				num: "2.2c",
				title: "Designing a Network: Units, Outputs, Depth & Width",
				summary:
					"Output units for Gaussian, Bernoulli and categorical targets, and other output types; ReLU and its generalisations: leaky, maxout, softplus; other hidden units; Universal approximation and exponential gains from depth; Weight-space symmetries; why fixed bases fail.",
				topics: [
					"Output units for Gaussian, Bernoulli and",
					"ReLU and its generalisations",
					"Universal approximation and exponential",
					"Weight-space symmetries",
				],
				slug: "network-design",
			},
			{
				num: "2.2d",
				title: "Mixture Density Networks & Mixtures of Experts",
				summary:
					"When the answer is multimodal; Mixtures of linear-regression and logistic models; Mixture density networks; Mixtures of experts and gating.",
				topics: [
					"When the answer is multimodal",
					"Mixtures of linear-regression and",
					"Mixture density networks",
					"Mixtures of experts and gating",
				],
				slug: "mixture-density-experts",
			},
			{
				num: "2.3",
				title: "Training Deep Networks",
				summary:
					"Race SGD, momentum and Adam down Rosenbrock's valley, push a learning rate until it explodes, watch Adam rescale each weight, collapse or revive a 10-layer network's activations on real images, rescue a deep net with BatchNorm and stop one memorising with dropout — then train Fashion-MNIST four ways.",
				topics: [
					"SGD, momentum, Adam",
					"Learning rates",
					"Initialisation",
					"BatchNorm & dropout",
				],
				href: "/lectures/training-deep-networks/",
				length: "~35 min",
				index: [
					["sgd", "Mini-batch SGD: a noisy compass"],
					["lr", "The learning rate: timid to explosive"],
					["momentum", "Momentum: a heavy ball"],
					["adam", "Adam: a step size per weight"],
					["schedule", "Schedules: warm up, cool down"],
					["init", "Initialisation: keep the signal alive"],
					["batchnorm", "BatchNorm: re-centring every layer"],
					["dropout", "Dropout: a crowd of thinned nets"],
					["project", "Fashion-MNIST, trained four ways"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.3a",
				title: "Why Deep Networks Are Hard to Optimise",
				summary:
					"Learning versus pure optimisation: empirical risk; Surrogate losses and early stopping; Ill-conditioning and local minima; Plateaus, saddle points and cliffs.",
				topics: [
					"Learning versus pure optimisation",
					"Surrogate losses and early stopping",
					"Ill-conditioning and local minima",
					"Plateaus, saddle points and cliffs",
				],
				slug: "optimisation-landscapes",
			},
			{
				num: "2.3b",
				title: "The Optimiser Zoo & Optimisation Strategies",
				summary:
					"Nesterov momentum; AdaGrad and RMSProp, leading to Adam; Coordinate descent and Polyak averaging; Supervised pretraining and designing models to aid optimisation.",
				topics: [
					"Nesterov momentum",
					"AdaGrad and RMSProp, leading to Adam",
					"Coordinate descent and Polyak averaging",
					"Supervised pretraining and designing",
				],
				slug: "optimiser-zoo",
			},
			{
				num: "2.3c",
				title: "Curvature: Jacobians, Hessians, Newton, CG & BFGS",
				summary:
					"The local quadratic approximation; using gradient information; The Jacobian of a network; The Hessian: diagonal, outer-product and inverse approximations; Finite differences, exact evaluation and fast Hessian-vector products.",
				topics: [
					"The local quadratic approximation",
					"The Jacobian of a network",
					"The Hessian",
					"Finite differences, exact evaluation and",
				],
				slug: "second-order-methods",
			},
			{
				num: "2.3d",
				title: "Regularising Deep Networks: Penalties, Noise, Augmentation & Sharing",
				summary:
					"Weight decay and norm penalties as constrained optimisation; consistent Gaussian priors; Early stopping as regularisation; Dataset augmentation and training with transformed data; Noise robustness and label smoothing.",
				topics: [
					"Weight decay and norm penalties as",
					"Early stopping as regularisation",
					"Dataset augmentation and training with",
					"Noise robustness and label smoothing",
				],
				slug: "regularising-deep-networks",
			},
			{
				num: "2.3e",
				title: "Adversarial Examples, Tangent Propagation & Robustness",
				summary:
					"Adversarial examples and the linearity explanation; FGSM and PGD attacks; Adversarial training; Tangent distance, tangent propagation and the manifold tangent classifier.",
				topics: [
					"Adversarial examples and the linearity",
					"FGSM and PGD attacks",
					"Adversarial training",
					"Tangent distance, tangent propagation and",
				],
				slug: "adversarial-robustness",
			},
			{
				num: "2.3f",
				title: "Bayesian Neural Networks",
				summary:
					"A posterior over weights; The Laplace approximation for networks; Hyperparameter optimisation by evidence; Bayesian networks for classification.",
				topics: [
					"A posterior over weights",
					"The Laplace approximation for networks",
					"Hyperparameter optimisation by evidence",
					"Bayesian networks for classification",
				],
				slug: "bayesian-neural-networks",
			},
			{
				num: "2.3g",
				title: "Practical Methodology: Baselines, Hyperparameter Search & Debugging",
				summary:
					"Performance metrics and default baseline models; Should we gather more data?; Manual hyperparameter tuning; Grid, random and model-based (Bayesian) optimisation.",
				topics: [
					"Performance metrics and default baseline",
					"Should we gather more data?",
					"Manual hyperparameter tuning",
					"Grid, random and model-based optimisation",
				],
				slug: "practical-methodology",
			},
			{
				num: "2.4",
				title: "Convolutional Neural Networks",
				summary:
					"Slide a kernel by hand, tune bias and ReLU on real digits, walk padding and stride, see what pooling forgives, grow receptive fields, count weights in LeNet, AlexNet, VGG and ResNet, watch residuals rescue the gradient — then draw a digit and see every feature map of a real trained CNN.",
				topics: [
					"Convolution, visualised",
					"Feature maps & pooling",
					"Classic architectures",
					"Residual connections",
				],
				href: "/lectures/convolutional-networks/",
				length: "~35 min",
				index: [
					["why", "Why images break dense networks"],
					["conv", "Convolution, one window at a time"],
					["maps", "Feature maps: where the pattern is"],
					["stride", "Padding, stride and output size"],
					["pool", "Pooling: keep the strongest signal"],
					["deep", "Channels and receptive fields"],
					["arch", "From LeNet to ResNet"],
					["residual", "Residuals: a gradient highway"],
					["project", "A CNN that reads your handwriting"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.4a",
				title: "Convolutions in Practice: Variants, Segmentation & Vision Pipelines",
				summary:
					"Convolution and pooling as an infinitely strong prior; Variants: dilated, transposed, locally connected, tiled; Structured outputs: segmentation; Data types and efficient convolution algorithms.",
				topics: [
					"Convolution and pooling as an infinitely",
					"Variants",
					"Structured outputs",
					"Data types and efficient convolution",
				],
				slug: "convolution-in-practice",
			},
			{
				num: "2.4b",
				title: "Image Formation & Classical Vision",
				summary:
					"Pinhole cameras, lenses and projection; Light, shading and colour; Edges; Texture.",
				topics: [
					"Pinhole cameras, lenses and projection",
					"Light, shading and colour",
					"Edges",
					"Texture",
				],
				slug: "classical-vision",
			},
			{
				num: "2.4c",
				title: "Object Detection, 3D Vision & Vision Applications",
				summary:
					"Detecting objects: region proposals and one-stage detectors; 3D cues from multiple views and binocular stereo; Structure from a moving camera and from one view; Understanding what people are doing.",
				topics: [
					"Detecting objects",
					"3D cues from multiple views and binocular",
					"Structure from a moving camera and from",
					"Understanding what people are doing",
				],
				slug: "detection-3d-vision",
			},
			{
				num: "2.5",
				title: "Recurrent Networks & LSTMs",
				summary:
					"Place pulses on a leaky memory, steer a two-unit RNN around the plane, send gradients back through time and watch them vanish or explode, wire an LSTM and a GRU by hand, race all three cells on a long-memory task — and sample Shakespeare from models whose gates you can inspect.",
				topics: [
					"Unrolling through time",
					"Vanishing gradients",
					"LSTM gates",
					"GRUs",
				],
				href: "/lectures/recurrent-networks/",
				length: "~35 min",
				index: [
					["why", "Why order needs memory"],
					["cell", "One rule, reused at every step"],
					["unroll", "Unrolling through time"],
					["vanish", "Vanishing & exploding gradients"],
					["lstm", "The LSTM's gated memory"],
					["gru", "GRUs: two gates, not three"],
					["race", "Who remembers longest?"],
					["project", "An LSTM that writes Shakespeare"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.5a",
				title: "RNN Architectures: Bidirectional, Stacked, Seq2seq & Recursive",
				summary:
					"Teacher forcing and output recurrence; Sequence classification with RNNs; Stacked and bidirectional RNNs; Conditioning on context and encoder-decoder seq2seq.",
				topics: [
					"Teacher forcing and output recurrence",
					"Sequence classification with RNNs",
					"Stacked and bidirectional RNNs",
					"Conditioning on context and",
				],
				slug: "rnn-architectures",
			},
			{
				num: "2.5b",
				title: "Long-Term Dependencies: Echo States, Leaky Units & Clipping",
				summary:
					"Echo state networks and reservoir computing; Skip connections through time; Leaky units and multiple time scales; Removing connections.",
				topics: [
					"Echo state networks and reservoir",
					"Skip connections through time",
					"Leaky units and multiple time scales",
					"Removing connections",
				],
				slug: "long-term-dependencies",
			},
			{
				num: "2.6",
				title: "Attention & Transformers",
				summary:
					"Click a word to see attention beat a fading memory, drag queries and keys through a soft dictionary, watch an unscaled softmax saturate, mask and shuffle self-attention, rotate sinusoidal positions, merge hand-wired heads, size GPT-2 and GPT-3 block by block — then read dates with a trained transformer whose 24 heads you can inspect and switch off.",
				topics: [
					"Why attention",
					"Queries, keys, values",
					"Multi-head attention",
					"The transformer block",
				],
				href: "/lectures/attention-transformers/",
				length: "~35 min",
				index: [
					["why", "Look back, don't remember"],
					["qkv", "Queries, keys and values"],
					["scale", "Why divide by √d"],
					["self", "Every token looks at every token"],
					["pos", "Positions: putting order back"],
					["multi", "Many heads, many questions"],
					["block", "The transformer block"],
					["project", "A transformer that reads dates"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.7",
				title: "Autoencoders & VAEs",
				summary:
					"Train a one-number bottleneck live, race PCA against a two-number autoencoder on real digits, walk and probe a latent map, watch reparameterised gradients beat REINFORCE, turn the β dial across five trained VAEs — and decode new MNIST digits under your pointer or from your own drawing.",
				topics: [
					"Encode → decode",
					"Latent spaces",
					"The VAE trick",
					"Generating samples",
				],
				href: "/lectures/autoencoders-vaes/",
				length: "~35 min",
				index: [
					["squeeze", "Squeeze through a bottleneck"],
					["pca", "A straight bottleneck is PCA"],
					["latent", "The latent space: a map of digits"],
					["vae", "Encode a cloud, not a point"],
					["trick", "The reparameterisation trick"],
					["kl", "The KL term: pull every cloud home"],
					["elbo", "The ELBO and the β dial"],
					["generate", "Generating new digits"],
					["project", "A 2-D VAE of MNIST, explored"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.7a",
				title: "Regularised Autoencoders: Sparse, Denoising & Contractive",
				summary:
					"Undercomplete versus regularised autoencoders; Sparse autoencoders; Denoising autoencoders and estimating the score; Contractive autoencoders and penalising derivatives.",
				topics: [
					"Undercomplete versus regularised",
					"Sparse autoencoders",
					"Denoising autoencoders and estimating the",
					"Contractive autoencoders and penalising",
				],
				slug: "regularised-autoencoders",
			},
			{
				num: "2.8",
				title: "GANs & Diffusion Models",
				summary:
					"Reshape a 1-D generator by hand, find the optimal discriminator and a mode-collapse trap, train a GAN and a diffusion model live in the page, watch gradient play spiral, steer samples with classifier-free guidance — then step a real diffusion model of handwritten digits from noise to ink.",
				topics: [
					"Generator vs discriminator",
					"Training instability",
					"Adding & removing noise",
					"Guided generation",
				],
				href: "/lectures/gans-diffusion/",
				length: "~35 min",
				index: [
					["why", "A generator is a map"],
					["critic", "The discriminator's verdict"],
					["game", "The GAN game, live"],
					["unstable", "Why GANs wobble"],
					["forward", "Adding noise, step by step"],
					["denoise", "Guess the noise"],
					["sample", "Running the noise backwards"],
					["guide", "Guidance: asking for something"],
					["compare", "GAN, VAE or diffusion?"],
					["project", "Digits out of noise"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.8a",
				title: "More Deep Generative Models: Autoregressive Nets, Moment Matching & GSNs",
				summary:
					"Sigmoid belief networks; Linear autoregressive networks and NADE; Generative moment-matching networks; Drawing samples from autoencoders: Markov chains, clamping, walk-back.",
				topics: [
					"Sigmoid belief networks",
					"Linear autoregressive networks and NADE",
					"Generative moment-matching networks",
					"Drawing samples from autoencoders",
				],
				slug: "more-generative-models",
			},
			{
				num: "2.9",
				title: "Transfer Learning",
				summary:
					"Look inside a CNN that learned 232,365 handwritten Japanese characters, compare digits in pixel and feature space, train a linear probe, fine-tune with a learning-rate dial while measuring forgetting, choose how much to freeze, measure domain shift — and race scratch, frozen and fine-tuned networks live on MNIST and Fashion-MNIST.",
				topics: [
					"Pretrained features",
					"Freeze or fine-tune",
					"Domain shift",
					"Small-data wins",
				],
				href: "/lectures/transfer-learning/",
				length: "~35 min",
				index: [
					["idea", "Borrow a network that already sees"],
					["features", "Pretrained features: a better space"],
					["probe", "Freeze the body, train a head"],
					["finetune", "Fine-tuning, gently"],
					["freeze", "How much to freeze?"],
					["shift", "Domain shift"],
					["small", "Small-data wins"],
					["project", "Digits from a Japanese-reading network"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "2.9a",
				title: "Representation Learning: Pretraining, Semi-supervised & Multitask",
				summary:
					"Greedy layer-wise unsupervised pretraining; when and why it works; Semi-supervised learning; Multitask learning; Distributed representations.",
				topics: [
					"Greedy layer-wise unsupervised pretraining",
					"Semi-supervised learning",
					"Multitask learning",
					"Distributed representations",
				],
				slug: "representation-learning",
			},
		],
	},
	{
		part: 3,
		id: "reinforcement-learning",
		name: "Reinforcement Learning & Decision Making",
		short: "RL",
		blurb:
			"Decisions under uncertainty, then agents that learn from reward: bandits, MDPs, dynamic programming, Monte Carlo and temporal-difference learning, function approximation, deep RL and policy gradients.",
		lectures: [
			{
				num: "3.0a",
				title: "Rational Decisions & Utility Theory",
				summary:
					"Combining beliefs and desires: maximum expected utility; Constraints on rational preferences; Rational preferences imply a utility function; Utility scales and the utility of money.",
				topics: [
					"Combining beliefs and desires",
					"Constraints on rational preferences",
					"Rational preferences imply a utility",
					"Utility scales and the utility of money",
				],
				slug: "utility-theory",
			},
			{
				num: "3.0b",
				title: "Decision Networks & the Value of Information",
				summary:
					"Representing decisions as decision networks; Evaluating decision networks; The value of perfect information; Properties of VOI and information-gathering agents.",
				topics: [
					"Representing decisions as decision",
					"Evaluating decision networks",
					"The value of perfect information",
					"Properties of VOI and",
				],
				slug: "decision-networks-voi",
			},
			{
				num: "3.1",
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
				num: "3.1a",
				title: "Bandits in Depth: UCB, Thompson Sampling, Gittins & Context",
				summary:
					"Tracking a nonstationary problem; Optimistic initial values; Upper-confidence-bound action selection; The Bernoulli bandit and Thompson sampling.",
				topics: [
					"Tracking a nonstationary problem",
					"Optimistic initial values",
					"Upper-confidence-bound action selection",
					"The Bernoulli bandit and Thompson sampling",
				],
				slug: "bandits-in-depth",
			},
			{
				num: "3.1b",
				title: "Dynamic Programming: Evaluate, Improve, Iterate",
				summary:
					"Policy evaluation; Policy improvement and policy iteration; Asynchronous DP and generalised policy iteration; Reward scales and the linear-programming view of MDPs.",
				topics: [
					"Policy evaluation",
					"Policy improvement and policy iteration",
					"Asynchronous DP and generalised policy",
					"Reward scales and the linear-programming",
				],
				slug: "dynamic-programming",
			},
			{
				num: "3.1c",
				title: "Monte Carlo Methods & Importance Sampling",
				summary:
					"Monte Carlo prediction and action values; Monte Carlo control with and without exploring starts; Off-policy prediction by importance sampling; Incremental implementation.",
				topics: [
					"Monte Carlo prediction and action values",
					"Monte Carlo control with and without",
					"Off-policy prediction by importance",
					"Incremental implementation",
				],
				slug: "monte-carlo-methods",
			},
			{
				num: "3.1d",
				title: "Temporal-Difference Learning in Depth",
				summary:
					"Advantages of TD prediction; Batch TD and the certainty-equivalence estimate; Expected Sarsa; Games, afterstates and tic-tac-toe.",
				topics: [
					"Advantages of TD prediction",
					"Batch TD and the certainty-equivalence",
					"Expected Sarsa",
					"Games, afterstates and tic-tac-toe",
				],
				slug: "td-learning",
			},
			{
				num: "3.1e",
				title: "n-step Bootstrapping",
				summary:
					"n-step TD prediction; n-step Sarsa; n-step off-policy learning; Control variates per decision.",
				topics: [
					"n-step TD prediction",
					"n-step Sarsa",
					"n-step off-policy learning",
					"Control variates per decision",
				],
				slug: "n-step-bootstrapping",
			},
			{
				num: "3.1f",
				title: "Models & Dyna: Planning While Learning",
				summary:
					"Models and planning; adaptive dynamic programming; Dyna: integrated planning, acting and learning; When the model is wrong; Prioritised sweeping.",
				topics: [
					"Models and planning",
					"Dyna",
					"When the model is wrong",
					"Prioritised sweeping",
				],
				slug: "dyna-model-based",
			},
			{
				num: "3.1g",
				title: "Decision-time Planning: Rollouts, MCTS & AlphaGo",
				summary:
					"Planning at decision time and heuristic search; Rollout algorithms; Monte Carlo tree search and UCT; Online algorithms for MDPs.",
				topics: [
					"Planning at decision time and heuristic",
					"Rollout algorithms",
					"Monte Carlo tree search and UCT",
					"Online algorithms for MDPs",
				],
				slug: "mcts-alphago",
			},
			{
				num: "3.1h",
				title: "POMDPs: Acting on Beliefs",
				summary:
					"Representing MDPs compactly; Observations, state and partial observability; Belief states as the new state; Value iteration for POMDPs.",
				topics: [
					"Representing MDPs compactly",
					"Observations, state and partial",
					"Belief states as the new state",
					"Value iteration for POMDPs",
				],
				slug: "pomdps",
			},
			{
				num: "3.1i",
				title: "Value-Function Approximation: Objectives, Semi-gradients & LSTD",
				summary:
					"The prediction objective (VE); Stochastic-gradient and semi-gradient methods; Approximating direct utility estimation; Selecting step sizes.",
				topics: [
					"The prediction objective",
					"Stochastic-gradient and semi-gradient",
					"Approximating direct utility estimation",
					"Selecting step sizes",
				],
				slug: "value-function-approximation",
			},
			{
				num: "3.1j",
				title: "Features for Linear RL: Polynomials, Fourier, Coarse & Tile Coding",
				summary:
					"Feature construction for linear methods; Polynomial features; The Fourier basis; Coarse coding.",
				topics: [
					"Feature construction for linear methods",
					"Polynomial features",
					"The Fourier basis",
					"Coarse coding",
				],
				slug: "feature-construction",
			},
			{
				num: "3.2",
				title: "Deep Q-Networks",
				summary:
					"Watch a discretised CartPole leave most cells unvisited, click updates into a linear Q, blow up the two-state deadly triad, probe a trained Q-network, compare replay buffers, tame Baird's counterexample with a target network, measure max-bias against Double DQN — and train a DQN live on a CartPole that matches Gymnasium step for step.",
				topics: [
					"Function approximation",
					"Experience replay",
					"Target networks",
					"Double DQN",
				],
				href: "/lectures/deep-q-networks/",
				length: "~35 min",
				index: [
					["why", "When the table is too big"],
					["approx", "One update, many states"],
					["triad", "The deadly triad, in two states"],
					["net", "A network that scores every move"],
					["replay", "Replay: shuffled memories"],
					["target", "Freezing the target"],
					["double", "Why max is an optimist"],
					["project", "Balancing a real CartPole, live"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "3.2a",
				title: "Continuing Tasks & Average Reward",
				summary:
					"Semi-gradient n-step Sarsa; Average reward: a new setting for continuing tasks; Why discounting is deprecated with approximation; Differential semi-gradient n-step Sarsa.",
				topics: [
					"Semi-gradient n-step Sarsa",
					"Average reward",
					"Why discounting is deprecated with",
					"Differential semi-gradient n-step Sarsa",
				],
				slug: "average-reward",
			},
			{
				num: "3.2b",
				title: "Stable Off-policy Learning: Bellman-error Geometry, Gradient-TD & Emphatic-TD",
				summary:
					"Semi-gradient off-policy methods and Baird's counterexample; Linear value-function geometry; Gradient descent in the Bellman error; The Bellman error is not learnable.",
				topics: [
					"Semi-gradient off-policy methods and",
					"Linear value-function geometry",
					"Gradient descent in the Bellman error",
					"The Bellman error is not learnable",
				],
				slug: "off-policy-approximation",
			},
			{
				num: "3.2c",
				title: "Eligibility Traces: the lambda-return, TD(lambda) & Sarsa(lambda)",
				summary:
					"The lambda-return; TD(lambda) and accumulating traces; Truncated lambda-return methods; Online lambda-return and true online TD(lambda).",
				topics: [
					"The lambda-return",
					"TD and accumulating traces",
					"Truncated lambda-return methods",
					"Online lambda-return and true online TD",
				],
				slug: "eligibility-traces",
			},
			{
				num: "3.2d",
				title: "Off-policy Traces: Q(lambda), Tree-Backup(lambda) & Stable Variants",
				summary:
					"Off-policy traces with control variates; Watkins's Q(lambda) to tree-backup(lambda); Stable off-policy methods with traces; Implementation issues.",
				topics: [
					"Off-policy traces with control variates",
					"Watkins's Q to tree-backup",
					"Stable off-policy methods with traces",
					"Implementation issues",
				],
				slug: "off-policy-traces",
			},
			{
				num: "3.3",
				title: "Policy Gradients & Actor–Critic",
				summary:
					"Find the best random policy on Sutton and Barto's short corridor, watch REINFORCE climb J(p) with and without a baseline, step an actor–critic through a gridworld, bend PPO's clipped objective — and train CartPole three ways live in the browser.",
				topics: [
					"REINFORCE",
					"Baselines & advantage",
					"Actor–critic",
					"PPO",
				],
				href: "/lectures/policy-gradients/",
				length: "~35 min",
				index: [
					["why", "Why learn the policy itself"],
					["softmax", "A policy with dials"],
					["theorem", "A slope you can sample"],
					["reinforce", "REINFORCE: credit by return"],
					["baseline", "Baselines cut the noise"],
					["critic", "Actor–critic: grade every step"],
					["ppo", "PPO: improve, not too far"],
					["gauss", "Continuous actions"],
					["project", "CartPole, three ways"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "3.3a",
				title: "RL Frontiers: Options, GVFs, Reward Design, Inverse RL & Safe Exploration",
				summary:
					"General value functions and auxiliary tasks; Temporal abstraction via options; hierarchical RL; Designing reward signals and reward shaping; Apprenticeship and inverse RL.",
				topics: [
					"General value functions and auxiliary",
					"Temporal abstraction via options",
					"Designing reward signals and reward",
					"Apprenticeship and inverse RL",
				],
				slug: "rl-frontiers",
			},
			{
				num: "3.3b",
				title: "RL Case Studies: TD-Gammon to Thermal Soaring",
				summary:
					"TD-Gammon and Samuel's checkers player; Watson's Daily-Double wagering; Optimising memory control; Applications in game playing and robot control.",
				topics: [
					"TD-Gammon and Samuel's checkers player",
					"Watson's Daily-Double wagering",
					"Optimising memory control",
					"Applications in game playing and robot",
				],
				slug: "rl-case-studies",
			},
			{
				num: "3.3c",
				title: "Animal Learning: Conditioning & the TD Model",
				summary:
					"Prediction and control in animals; Classical conditioning, blocking and higher-order conditioning; The Rescorla-Wagner model; The TD model and its simulations.",
				topics: [
					"Prediction and control in animals",
					"Classical conditioning, blocking and",
					"The Rescorla-Wagner model",
					"The TD model and its simulations",
				],
				slug: "rl-psychology",
			},
			{
				num: "3.3d",
				title: "Dopamine & the Reward Prediction Error",
				summary:
					"Neuroscience basics; Reward, reinforcement and value signals; The reward-prediction-error hypothesis; Dopamine.",
				topics: [
					"Neuroscience basics",
					"Reward, reinforcement and value signals",
					"The reward-prediction-error hypothesis",
					"Dopamine",
				],
				slug: "dopamine-rpe",
			},
			{
				num: "3.3e",
				title: "The Brain's Actor-Critic, Hedonistic Neurons & Addiction",
				summary:
					"Neural actor-critic; Actor and critic learning rules; Hedonistic neurons; Collective reinforcement learning.",
				topics: [
					"Neural actor-critic",
					"Actor and critic learning rules",
					"Hedonistic neurons",
					"Collective reinforcement learning",
				],
				slug: "neural-actor-critic",
			},
		],
	},
	{
		part: 4,
		id: "large-language-models",
		name: "Large Language Models",
		short: "LLM",
		blurb:
			"How modern language models are built and used: tokens and embeddings, transformers at scale, alignment, prompting and retrieval.",
		lectures: [
			{
				num: "4.0a",
				title: "Words, Unicode & Regular Expressions",
				summary:
					"Words, morphemes and corpora; Unicode code points and UTF-8; Regular expressions: classes, counters, anchors, groups; Substitutions, capture groups and lookahead.",
				topics: [
					"Words, morphemes and corpora",
					"Unicode code points and UTF-8",
					"Regular expressions",
					"Substitutions, capture groups and",
				],
				slug: "words-unicode-regex",
			},
			{
				num: "4.0b",
				title: "Edit Distance & Spelling Correction",
				summary:
					"Minimum edit distance; The dynamic-programming algorithm and alignment; The noisy-channel model; Real-word spelling errors.",
				topics: [
					"Minimum edit distance",
					"The dynamic-programming algorithm and",
					"The noisy-channel model",
					"Real-word spelling errors",
				],
				slug: "edit-distance-spelling",
			},
			{
				num: "4.1",
				title: "Language Modelling",
				summary:
					"Play the next-word guessing game against a model of Pride and Prejudice, score sentences with the chain rule, count n-grams, write text Shannon's way, measure perplexity, tune add-k and Kneser–Ney smoothing, and watch a softmax network rediscover the count table.",
				topics: [
					"Next-word prediction",
					"n-gram models",
					"Perplexity",
					"From counts to networks",
				],
				href: "/lectures/language-modelling/",
				length: "~35 min",
				index: [
					["why", "Guess the next word"],
					["chain", "A sentence as a chain of guesses"],
					["ngram", "n-grams: counting short histories"],
					["sample", "Writing with an n-gram"],
					["perplexity", "Perplexity: how torn is the model?"],
					["smooth", "Zeros and add-k smoothing"],
					["kn", "Kneser–Ney"],
					["neural", "From counts to networks"],
					["project", "A Kneser–Ney Austen"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.2",
				title: "Tokens & Embeddings",
				summary:
					"Tokenise text four ways, run byte-pair encoding by hand and on Pride and Prejudice, count which Wikipedia words keep company and squeeze the table with SVD, solve analogies, train word2vec live, and give \"bank\" a contextual vector.",
				topics: [
					"Tokenisation & BPE",
					"Word embeddings",
					"Meaning as geometry",
					"Contextual embeddings",
				],
				href: "/lectures/tokens-embeddings/",
				length: "~35 min",
				index: [
					["why", "Text is not numbers"],
					["bpe", "Byte-pair encoding by hand"],
					["merges", "How many merges?"],
					["lookup", "The embedding table"],
					["company", "The company a word keeps"],
					["svd", "Squeezing with SVD"],
					["geometry", "Distances and analogies"],
					["skipgram", "word2vec"],
					["context", "Contextual embeddings"],
					["project", "Austen & Wikipedia project"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.3",
				title: "The Transformer, Inside an LLM",
				summary:
					"Write with a live 213,056-weight GPT, follow one character up the stack, rewrite the future and watch the causal mask hold, split a logit into each residual write, read every layer through the logit lens, inspect all 16 heads, and step the KV cache — checking that cached decoding gives exactly the same logits.",
				topics: [
					"Decoder-only models",
					"Masked self-attention",
					"The residual stream",
					"Logits to words",
				],
				href: "/lectures/inside-an-llm/",
				length: "~35 min",
				index: [
					["next", "One job: the next token"],
					["stack", "The decoder-only stack"],
					["mask", "No peeking: the causal mask"],
					["logits", "From logits to words"],
					["stream", "The residual stream"],
					["lens", "The logit lens"],
					["heads", "What the heads learned"],
					["generate", "Writing and the KV cache"],
					["project", "A tiny GPT that writes Austen"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.3a",
				title: "BERT & Masked Language Models",
				summary:
					"Three architectures: encoder, decoder, encoder-decoder; Bidirectional transformer encoders; Masking words and next-sentence prediction; Training regimes.",
				topics: [
					"Three architectures",
					"Bidirectional transformer encoders",
					"Masking words and next-sentence prediction",
					"Training regimes",
				],
				slug: "masked-language-models",
			},
			{
				num: "4.4",
				title: "Pre-training at Scale",
				summary:
					"Drag a model across the Chinchilla loss plane, train a character model on Sherlock Holmes live, repeat data to see diminishing returns, cost real models with 6ND, size models for training and inference — and fit your own scaling law to 30 models trained in the browser.",
				topics: [
					"Data at scale",
					"Scaling laws",
					"Compute budgets",
					"Emergent abilities",
				],
				href: "/lectures/pretraining-at-scale/",
				length: "~35 min",
				index: [
					["objective", "One objective, a trillion times"],
					["data", "Data at scale"],
					["power", "Power laws on log–log paper"],
					["compute", "Counting compute: C ≈ 6ND"],
					["chinchilla", "Compute-optimal: Chinchilla"],
					["inference", "Beyond Chinchilla: paying for use"],
					["emergence", "Emergence, or a mirage?"],
					["project", "A scaling law of your own"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.4a",
				title: "Data for LLMs: Quality, Coverage, Deduplication & Filtering",
				summary:
					"Training data, multilingual and domain-specific models; Data quality, coverage and quantity; Acquisition and annotation; Inspecting data.",
				topics: [
					"Training data, multilingual and",
					"Data quality, coverage and quantity",
					"Acquisition and annotation",
					"Inspecting data",
				],
				slug: "data-curation",
			},
			{
				num: "4.4b",
				title: "GPUs, Accelerators & Distributed Training",
				summary:
					"Fast CPU and GPU implementations; Running PyTorch on GPUs; Data, tensor and pipeline parallelism; Large-scale distributed training.",
				topics: [
					"Fast CPU and GPU implementations",
					"Running PyTorch on GPUs",
					"Data, tensor and pipeline parallelism",
					"Large-scale distributed training",
				],
				slug: "gpus-distributed-training",
			},
			{
				num: "4.4c",
				title: "Precision, Memory Maths & Quantisation",
				summary:
					"Tensor data types: fp32, bf16, fp16, int8; Memory bottlenecks: backprop and trainable parameters; Memory maths for training and inference; Numerical representations.",
				topics: [
					"Tensor data types",
					"Memory bottlenecks",
					"Memory maths for training and inference",
					"Numerical representations",
				],
				slug: "precision-quantisation",
			},
			{
				num: "4.5",
				title: "Decoding & Sampling",
				summary:
					"Click through a tree of forking next-word paths, watch greedy decoding fall into a loop, widen a beam and add a length penalty, see the likelihood trap on held-out Doyle, then tune temperature, top-k, top-p and a repetition penalty on a Sherlock Holmes trigram — checked word for word against Python.",
				topics: [
					"Greedy & beam search",
					"Temperature",
					"Top-k & top-p",
					"Repetition & creativity",
				],
				href: "/lectures/decoding-sampling/",
				length: "~35 min",
				index: [
					["why", "One model, many texts"],
					["greedy", "Greedy decoding"],
					["beam", "Beam search"],
					["trap", "The likelihood trap"],
					["temperature", "Temperature"],
					["topk", "Top-k sampling"],
					["topp", "Top-p (nucleus) sampling"],
					["repeat", "Repetition and creativity"],
					["project", "Decoding Doyle"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.5a",
				title: "Inference Optimisation: Prefill, Decode, Batching & Speculation",
				summary:
					"Inference overview: prefill versus decode; Performance metrics: latency, TTFT, throughput, cost; Model optimisation: pruning, distillation, dynamic structure; Batching, paged KV cache and serving.",
				topics: [
					"Inference overview",
					"Performance metrics",
					"Model optimisation",
					"Batching, paged KV cache and serving",
				],
				slug: "inference-optimisation",
			},
			{
				num: "4.5b",
				title: "Machine Translation & Encoder-Decoder Models",
				summary:
					"Language divergences: word order, lexical gaps, referential density; Encoder-decoder MT and tokenisation; Creating parallel training data; RNN and transformer encoder-decoders.",
				topics: [
					"Language divergences",
					"Encoder-decoder MT and tokenisation",
					"Creating parallel training data",
					"RNN and transformer encoder-decoders",
				],
				slug: "machine-translation",
			},
			{
				num: "4.5c",
				title: "Scoring Generated Text: BLEU, chrF, COMET & Human Ratings",
				summary:
					"Human evaluation of MT and generation; BLEU and chrF; Embedding-based metrics: BERTScore and COMET; Exact match and similarity against reference data.",
				topics: [
					"Human evaluation of MT and generation",
					"BLEU and chrF",
					"Embedding-based metrics",
					"Exact match and similarity against",
				],
				slug: "scoring-generated-text",
			},
			{
				num: "4.6",
				title: "Fine-tuning & LoRA",
				summary:
					"Turn a LoRA adapter's dial from Austen to Shakespeare, race a pretrained model against one trained from scratch, fine-tune live, mask an instruction-tuning loss, take the SVD of a real weight update, merge adapters, size PEFT methods for GPT-3, and measure catastrophic forgetting.",
				topics: [
					"Supervised fine-tuning",
					"Instruction tuning",
					"LoRA & adapters",
					"Catastrophic forgetting",
				],
				href: "/lectures/fine-tuning-lora/",
				length: "~35 min",
				index: [
					["why", "Why fine-tune: a head start"],
					["sft", "Supervised fine-tuning"],
					["instruct", "Instruction tuning and the loss mask"],
					["lora", "LoRA: a thin update BA"],
					["merge", "Start at zero, merge at the end"],
					["peft", "Adapters, prefixes and prompts"],
					["forget", "Catastrophic forgetting"],
					["project", "An Austen model learns Shakespeare"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.6a",
				title: "Fine-tuning a Real GPT-2: a Classifier & an Instruction Follower",
				summary:
					"Loading the OpenAI GPT-2 weights; Categories of fine-tuning; Adding a classification head and training a spam classifier; Formatting and batching instruction data.",
				topics: [
					"Loading the OpenAI GPT-2 weights",
					"Categories of fine-tuning",
					"Adding a classification head and training",
					"Formatting and batching instruction data",
				],
				slug: "fine-tuning-gpt2",
			},
			{
				num: "4.7",
				title: "Alignment: RLHF & DPO",
				summary:
					"Compare ratings with pairwise votes, fit Bradley–Terry scores and a reward model by gradient descent, tilt a policy with the KL leash, train it with PPO, watch a proxy reward get over-optimised, step DPO's loss and see it break — then align a policy to real human votes from Anthropic's HH-RLHF data.",
				topics: [
					"Human preferences",
					"Reward models",
					"RLHF with PPO",
					"DPO",
				],
				href: "/lectures/alignment-rlhf-dpo/",
				length: "~35 min",
				index: [
					["why", "Judging beats writing"],
					["bt", "Bradley–Terry scores"],
					["rm", "Training a reward model"],
					["kl", "Reward, on a leash"],
					["ppo", "RLHF with PPO"],
					["hack", "Over-optimisation"],
					["dpo", "DPO: the policy is the reward"],
					["ipo", "When DPO slips the leash"],
					["project", "Aligning to real human votes"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.7a",
				title: "Synthetic Data & Distillation",
				summary:
					"Why synthesise data; Traditional synthesis: rules and perturbation; AI-powered synthesis: self-instruct and evolution; Verifying and filtering synthetic data.",
				topics: [
					"Why synthesise data",
					"Traditional synthesis",
					"AI-powered synthesis",
					"Verifying and filtering synthetic data",
				],
				slug: "synthetic-data-distillation",
			},
			{
				num: "4.8",
				title: "Prompting & In-Context Learning",
				summary:
					"Drag the examples in a prompt and watch a real transformer with frozen weights change its answer, measure zero-, one- and few-shot error against least squares and the Bayes-optimal rule, corrupt labels and shuffle examples, train a toy with and without a chain of thought, compute self-consistency votes exactly, build prompts from patterns — then prompt the transformer with real Old Faithful eruptions.",
				topics: [
					"Zero & few-shot",
					"Chain of thought",
					"Prompt patterns",
					"In-context learning",
				],
				href: "/lectures/prompting-icl/",
				length: "~35 min",
				index: [
					["why", "Learning without changing a weight"],
					["shots", "Zero-, one-, few-shot"],
					["bayes", "What is it computing?"],
					["demos", "What do the examples teach?"],
					["cot", "Chain of thought"],
					["vote", "Self-consistency"],
					["patterns", "Prompt patterns"],
					["project", "Prompting with Old Faithful"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.8a",
				title: "Prompt Engineering in Practice",
				summary:
					"System and user prompts; Context length and context efficiency; Clear instructions and sufficient context; Structured outputs and constrained decoding.",
				topics: [
					"System and user prompts",
					"Context length and context efficiency",
					"Clear instructions and sufficient context",
					"Structured outputs and constrained",
				],
				slug: "prompt-engineering",
			},
			{
				num: "4.9",
				title: "Retrieval-Augmented Generation",
				summary:
					"Ask a library of real Wikipedia articles about the Solar System a question, chunk it by sentences or windows, tune BM25, grade retrievers with recall@k and MRR, build LSA embeddings in the browser, probe an IVF index, fuse rankings with RRF, fit a re-ranker, and watch cited, extractive answers decline when the evidence is weak.",
				topics: [
					"Chunk & embed",
					"Vector search",
					"Re-ranking",
					"Grounded answers",
				],
				href: "/lectures/retrieval-augmented-generation/",
				length: "~35 min",
				index: [
					["why", "Retrieve, then read"],
					["chunk", "Cutting documents into chunks"],
					["bm25", "BM25: scoring by words"],
					["measure", "Recall@k and MRR"],
					["embed", "Embeddings: scoring by meaning"],
					["search", "Vector search at scale"],
					["hybrid", "Hybrid search with RRF"],
					["rerank", "Re-ranking the top 20"],
					["ground", "Grounded, cited answers"],
					["project", "A cited answer desk"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.9a",
				title: "Prompt, Retrieve or Fine-tune? Model Merging & Fine-tuning Tactics",
				summary:
					"From foundation models to AI engineering; When to fine-tune and when not to; Fine-tuning versus RAG; Model merging and multi-task fine-tuning.",
				topics: [
					"From foundation models to AI engineering",
					"When to fine-tune and when not to",
					"Fine-tuning versus RAG",
					"Model merging and multi-task fine-tuning",
				],
				slug: "prompt-rag-or-finetune",
			},
			{
				num: "4.10",
				title: "Evaluating LLMs",
				summary:
					"Shrink a real 34-model leaderboard and watch its ranks dissolve, simulate sittings of HumanEval and MMLU, bootstrap MT-bench scores by question and by turn, pair two models question by question, size a benchmark and check the promised power by simulation, shuffle 3,355 expert votes through Elo against Bradley–Terry, measure GPT-4's agreement with experts (κ) and its position bias with a fitted toy judge, score a SelfCheckGPT hallucination detector on 1,908 labelled GPT-3 sentences, and read red-team success rates with Wilson intervals and the rule of three.",
				topics: [
					"Benchmarks",
					"LLM-as-judge",
					"Hallucination",
					"Red-teaming",
				],
				href: "/lectures/evaluating-llms/",
				length: "~40 min",
				index: [
					["why", "A score is an estimate"],
					["boot", "Bootstrap confidence intervals"],
					["paired", "Is A really better than B?"],
					["size", "How many questions are enough"],
					["arena", "Elo and Bradley–Terry"],
					["judge", "LLM-as-a-judge"],
					["bias", "The judge's position bias"],
					["halluc", "Catching hallucinations"],
					["redteam", "Red-teaming by the numbers"],
					["project", "Auditing a real leaderboard"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "4.10a",
				title: "Interpretability: Probes, Patching, SAEs & Induction Heads",
				summary:
					"Linguistic structure inside models; Probing classifiers; Sparse autoencoders and features; Causal techniques: activation patching and ablation.",
				topics: [
					"Linguistic structure inside models",
					"Probing classifiers",
					"Sparse autoencoders and features",
					"Causal techniques",
				],
				slug: "interpretability",
			},
			{
				num: "4.10b",
				title: "Defensive Prompting: Jailbreaks, Prompt Leaks & Data Extraction",
				summary:
					"Proprietary prompts and reverse prompt engineering; Jailbreaking and prompt injection; Training-data and information extraction; Defences: instruction hierarchy, filters, red-team loops.",
				topics: [
					"Proprietary prompts and reverse prompt",
					"Jailbreaking and prompt injection",
					"Training-data and information extraction",
					"Defences",
				],
				slug: "jailbreaks-extraction",
			},
		],
	},
	{
		part: 5,
		id: "ai-agents",
		name: "AI Agents",
		short: "AGT",
		blurb:
			"Language models that act: using tools, reasoning step by step, remembering, working in teams — and doing it safely.",
		lectures: [
			{
				num: "5.1",
				title: "What Is an AI Agent?",
				summary:
					"Step an agent round the observe–think–act loop as it plays a word game against 2,000 real English words, watch its prompt grow while the words that fit shrink, split candidates by expected bits, sample actions with a temperature, simulate compounding error and pass^k, budget tokens, cost and latency, gate risky actions by autonomy level, and weigh when an agent beats doing it by hand.",
				topics: [
					"The agent loop",
					"LLM as controller",
					"Levels of autonomy",
					"When to use agents",
				],
				href: "/lectures/what-is-an-agent/",
				length: "~35 min",
				index: [
					["why", "From answers to actions"],
					["loop", "The agent loop"],
					["think", "Choosing the most informative action"],
					["controller", "An LLM as the controller"],
					["compound", "Why long tasks fail"],
					["budget", "Cost and latency budgets"],
					["autonomy", "Levels of autonomy"],
					["when", "When to use an agent"],
					["project", "An agent loop over 2,000 real words"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "5.1a",
				title: "Rational Agents & Task Environments",
				summary:
					"The rational-agent definition of AI; Performance measures, omniscience, learning and autonomy; Specifying task environments (PEAS) and their properties; Agent programs: simple reflex and model-based reflex.",
				topics: [
					"The rational-agent definition of AI",
					"Performance measures, omniscience",
					"Specifying task environments and their",
					"Agent programs",
				],
				slug: "rational-agents",
			},
			{
				num: "5.2",
				title: "Tool Use & Function Calling",
				summary:
					"Watch a memorised exchange rate go stale against 27 years of real ECB rates, break a tool's arguments and see which JSON Schema keyword fails, step through the exact Anthropic and OpenAI messages of the function-calling loop, route requests with tool_choice, weigh result size against rounds, race parallel against serial calls, tune timeouts and backoff on 2,000 simulated calls, and talk JSON-RPC to a live MCP server.",
				topics: [
					"Tool schemas",
					"Function calling",
					"Handling results",
					"MCP & APIs",
				],
				href: "/lectures/tool-use/",
				length: "~35 min",
				index: [
					["why", "Why a model needs tools"],
					["schema", "Tools as JSON Schema"],
					["loop", "The function-calling loop"],
					["choose", "Choosing a tool"],
					["results", "Handling results"],
					["parallel", "Parallel calls"],
					["fail", "Timeouts and retries"],
					["mcp", "MCP and JSON-RPC"],
					["project", "A tool router over real data"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "5.3",
				title: "Reasoning & Planning",
				summary:
					"Tap two stations on the real London Underground and watch A* find the route, then trap a greedy walker in a loop and buy it lookahead, grow BFS rings, trade changes for riding time in Dijkstra, bend A* with a heuristic weight, order a five-stop errand out of 120 tours, step through a transparent ReAct agent that checks the status board, compare plan-and-execute with thinking at every stop over 300 disrupted journeys, and watch Reflexion-style lessons turn blind retries into solved trips.",
				topics: [
					"ReAct",
					"Task decomposition",
					"Plan-and-execute",
					"Reflection",
				],
				href: "/lectures/reasoning-planning/",
				length: "~35 min",
				index: [
					["why", "Acting without thinking ahead"],
					["bfs", "Breadth-first search"],
					["dijkstra", "Dijkstra: the quickest plan"],
					["astar", "A*: search with a sense of direction"],
					["decompose", "Task decomposition"],
					["react", "ReAct: think, act, observe"],
					["replan", "Plan, execute, re-plan"],
					["reflect", "Reflection and retry"],
					["project", "A Tube journey agent"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "5.4",
				title: "Memory for Agents",
				summary:
					"Watch the context bill grow quadratically, step through the real GPT-2 byte-pair encoder merge by merge, slide a context window over a five-month LoCoMo conversation, compare rolling summaries, query a TF-IDF vector store, weigh recency, importance and relevance, and race four forgetting rules, all measured by recall of 150 annotated facts.",
				topics: [
					"Context as memory",
					"Summarisation",
					"Vector-store memory",
					"Forgetting on purpose",
				],
				href: "/lectures/agent-memory/",
				length: "~35 min",
				index: [
					["why", "The context is the only memory"],
					["tokens", "Counting in tokens: BPE"],
					["window", "The sliding window"],
					["summarise", "Rolling summaries"],
					["vector", "Vector-store memory"],
					["score", "Recency, importance, relevance"],
					["forget", "Forgetting on purpose"],
					["project", "A memory simulator"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "5.5",
				title: "Multi-Agent Systems",
				summary:
					"Watch 39 real annotators vote on 108 bird photos, test Condorcet's jury theorem and see correlation cap it, schedule an orchestrator's task graph and slow jobs on the critical path, find the team size where crosstalk makes agents slower, run thousands of debates and critique loops, lose facts down a hand-off chain, count n(n-1)/2 conversations, and let Dawid-Skene EM learn whom to trust without an answer key.",
				topics: [
					"Orchestrator & workers",
					"Debate & critique",
					"Hand-offs",
					"Coordination costs",
				],
				href: "/lectures/multi-agent-systems/",
				length: "~35 min",
				index: [
					["why", "Many minds: the jury theorem"],
					["correlated", "When agents think alike"],
					["orchestrator", "Orchestrator and workers"],
					["scaling", "Amdahl and the cost of syncing"],
					["debate", "Debate: changing minds"],
					["critique", "Critique: a checker in the loop"],
					["handoff", "Hand-offs: passing the baton"],
					["topology", "Who talks to whom"],
					["project", "39 annotators, one verdict"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "5.5a",
				title: "Game Theory for Multi-Agent Systems",
				summary:
					"One versus many decision makers; multiagent planning and coordination; Normal-form games, dominance and Nash equilibria; Social welfare and Pareto optimality; Repeated games and the prisoner's dilemma.",
				topics: [
					"One versus many decision makers",
					"Normal-form games, dominance and Nash",
					"Social welfare and Pareto optimality",
					"Repeated games and the prisoner's dilemma",
				],
				slug: "game-theory",
			},
			{
				num: "5.5b",
				title: "Cooperation, Auctions, Voting & Bargaining",
				summary:
					"Coalition structures, the core and the Shapley value; Computation in cooperative games; Allocating tasks with the contract net; Auctions: English, sealed-bid, Vickrey.",
				topics: [
					"Coalition structures, the core and the",
					"Computation in cooperative games",
					"Allocating tasks with the contract net",
					"Auctions",
				],
				slug: "collective-decisions",
			},
			{
				num: "5.6",
				title: "Agent Safety & Evaluation",
				summary:
					"Switch the legs of the lethal trifecta on and off, watch injected instructions hijack 100 simulated tasks with and without spotlighting, trade detector misses against false alarms at realistic base rates, trace trust labels through a privilege-separated plan, tighten a sandbox manifest until path and host tricks stop working, find the gate threshold where approval fatigue costs least, and see why Wald intervals and pass@k flatter an agent that Wilson intervals and pass^k judge honestly.",
				topics: [
					"Prompt injection",
					"Sandboxes & permissions",
					"Human in the loop",
					"Evaluating agents",
				],
				href: "/lectures/agent-safety/",
				length: "~35 min",
				index: [
					["why", "The lethal trifecta"],
					["inject", "Prompt injection"],
					["detect", "Detectors and base rates"],
					["privilege", "Privilege separation"],
					["sandbox", "Sandboxes and permissions"],
					["human", "A human in the loop"],
					["evaluate", "Success rates with error bars"],
					["passk", "pass@k and pass^k"],
					["project", "An injection playground"],
					["summary", "Five lines to remember"],
				],
			},
			{
				num: "5.7",
				title: "Project: Build an Agent",
				summary:
					"Assemble a working agent over the real Palmer penguins data: step through its loop and watch the token bill grow, feed its tools malformed calls with schema validation on and off, tune retries and backoff, shrink the context window under four memory strategies, fend off planted prompt injections with least privilege, an allow-list and a reviewer, run a seeded 20-task suite with Wilson intervals, pass@k and pass^k, break it with a fault-by-guard ablation, and see every step as Anthropic Messages API JSON, with the same agent written for Claude.",
				topics: [
					"Design the loop",
					"Add tools",
					"Add memory",
					"Test & harden",
				],
				href: "/lectures/build-an-agent/",
				length: "~35 min",
				index: [
					["why", "Four parts, one agent"],
					["loop", "Design the loop"],
					["tools", "Tools, checked on every call"],
					["recover", "Timeouts, retries, backoff"],
					["memory", "What the model still sees"],
					["guards", "Guards against injection"],
					["test", "Test it like software"],
					["harden", "Break it on purpose"],
					["claude", "Swap in a real model"],
					["project", "Assemble it, then prove it"],
					["summary", "Five lines to remember"],
				],
			},
		],
	},
	{
		part: 6,
		id: "probabilistic-models",
		name: "Probabilistic Models & Inference",
		short: "PGM",
		blurb:
			"Models built from probability: Bayesian networks and Markov random fields, mixtures and EM, latent-variable and sequence models, sampling and MCMC, variational inference and probabilistic programming.",
		lectures: [
			{
				num: "6.1",
				title: "Bayesian Networks",
				summary:
					"Why structure: the challenge of unstructured models; Directed graphs and factorisation; Generative models and ancestral sampling; Discrete variables and efficient CPDs (noisy-OR).",
				topics: [
					"Why structure",
					"Directed graphs and factorisation",
					"Generative models and ancestral sampling",
					"Discrete variables and efficient CPDs",
				],
				slug: "bayesian-networks",
			},
			{
				num: "6.2",
				title: "Conditional Independence & d-Separation",
				summary:
					"Three example graphs: chain, fork, collider; Explaining away; d-separation; Markov blankets.",
				topics: [
					"Three example graphs",
					"Explaining away",
					"d-separation",
					"Markov blankets",
				],
				slug: "d-separation",
			},
			{
				num: "6.3",
				title: "Markov Random Fields",
				summary:
					"Undirected graphs and Markov graph properties; Conditional independence in undirected models; Factorisation into cliques and potentials; Image de-noising with an Ising model.",
				topics: [
					"Undirected graphs and Markov graph",
					"Conditional independence in undirected",
					"Factorisation into cliques and potentials",
					"Image de-noising with an Ising model",
				],
				slug: "markov-random-fields",
			},
			{
				num: "6.4",
				title: "Exact Inference: Enumeration & Variable Elimination",
				summary:
					"Inference by enumeration; The variable elimination algorithm; Elimination order and the complexity of exact inference; Inference and approximate inference in deep models: the landscape.",
				topics: [
					"Inference by enumeration",
					"The variable elimination algorithm",
					"Elimination order and the complexity of",
					"Inference and approximate inference in",
				],
				slug: "exact-inference",
			},
			{
				num: "6.5",
				title: "Factor Graphs & the Sum-Product Algorithm",
				summary:
					"Inference on a chain; Trees; Factor graphs; The sum-product algorithm.",
				topics: [
					"Inference on a chain",
					"Trees",
					"Factor graphs",
					"The sum-product algorithm",
				],
				slug: "sum-product",
			},
			{
				num: "6.6",
				title: "Max-sum, Junction Trees & Loopy Belief Propagation",
				summary:
					"The max-sum algorithm; Exact inference in general graphs: the junction tree; Clustering algorithms; Loopy belief propagation and when it works.",
				topics: [
					"The max-sum algorithm",
					"Exact inference in general graphs",
					"Clustering algorithms",
					"Loopy belief propagation and when it works",
				],
				slug: "max-sum-junction-loopy",
			},
			{
				num: "6.7",
				title: "Monte Carlo Basics: Inverse CDF, Rejection & Importance Sampling",
				summary:
					"Why sampling, and the basics of Monte Carlo estimates; Sampling standard distributions; Rejection and adaptive rejection sampling; Importance sampling and likelihood weighting.",
				topics: [
					"Why sampling, and the basics of Monte",
					"Sampling standard distributions",
					"Rejection and adaptive rejection sampling",
					"Importance sampling and likelihood",
				],
				slug: "monte-carlo-basics",
			},
			{
				num: "6.8",
				title: "Markov Chain Monte Carlo: Metropolis-Hastings & Gibbs",
				summary:
					"Markov chains and stationary distributions; The Metropolis-Hastings algorithm; Gibbs sampling; MCMC for posterior inference.",
				topics: [
					"Markov chains and stationary distributions",
					"The Metropolis-Hastings algorithm",
					"Gibbs sampling",
					"MCMC for posterior inference",
				],
				slug: "mcmc",
			},
			{
				num: "6.9",
				title: "Slice Sampling, Hamiltonian Monte Carlo & Partition Functions",
				summary:
					"Slice sampling; Dynamical systems and Hamiltonian dynamics; Hybrid (Hamiltonian) Monte Carlo; Estimating the partition function.",
				topics: [
					"Slice sampling",
					"Dynamical systems and Hamiltonian dynamics",
					"Hybrid Monte Carlo",
					"Estimating the partition function",
				],
				slug: "advanced-mcmc",
			},
			{
				num: "6.10",
				title: "Variational Inference: Mean Field",
				summary:
					"Inference as optimisation; the ELBO again; Factorised (mean-field) distributions; Properties of factorised approximations; Example: the univariate Gaussian.",
				topics: [
					"Inference as optimisation",
					"Factorised distributions",
					"Properties of factorised approximations",
					"Example",
				],
				slug: "variational-inference",
			},
			{
				num: "6.11",
				title: "Variational Mixture of Gaussians",
				summary:
					"The variational distribution for a mixture; The variational lower bound; The predictive density; Determining the number of components automatically.",
				topics: [
					"The variational distribution for a mixture",
					"The variational lower bound",
					"The predictive density",
					"Determining the number of components",
				],
				slug: "variational-mixtures",
			},
			{
				num: "6.12",
				title: "Variational Regression, Local Bounds & Variational Logistic Regression",
				summary:
					"Variational linear regression: distribution, predictive, bound; Local variational methods and convex duality; Variational logistic regression; Optimising the variational parameters.",
				topics: [
					"Variational linear regression",
					"Local variational methods and convex",
					"Variational logistic regression",
					"Optimising the variational parameters",
				],
				slug: "variational-regression-bounds",
			},
			{
				num: "6.13",
				title: "Expectation Propagation, Variational Message Passing & Learned Inference",
				summary:
					"Exponential-family variational updates; Variational message passing; Expectation propagation and the clutter problem; EP on graphs.",
				topics: [
					"Exponential-family variational updates",
					"Variational message passing",
					"Expectation propagation and the clutter",
					"EP on graphs",
				],
				slug: "ep-message-passing",
			},
			{
				num: "6.14",
				title: "Hidden Markov Models: Filtering, Smoothing & Viterbi",
				summary:
					"Markov chains, states, transitions and sensors; Filtering and prediction: the forward algorithm; Smoothing: forward-backward; The most likely sequence: Viterbi.",
				topics: [
					"Markov chains, states, transitions and",
					"Filtering and prediction",
					"Smoothing",
					"The most likely sequence",
				],
				slug: "hmm-inference",
			},
			{
				num: "6.15",
				title: "Learning HMMs: Baum-Welch, Extensions & POS Tagging",
				summary:
					"Maximum likelihood for the HMM and Baum-Welch (EM); The sum-product view of the HMM; HMM part-of-speech tagging: components and decoding; A worked tagging example.",
				topics: [
					"Maximum likelihood for the HMM and",
					"The sum-product view of the HMM",
					"HMM part-of-speech tagging",
					"A worked tagging example",
				],
				slug: "hmm-learning-tagging",
			},
			{
				num: "6.16",
				title: "Linear Dynamical Systems & the Kalman Filter",
				summary:
					"Updating Gaussian beliefs; A one-dimensional example; Inference in linear dynamical systems: the general Kalman filter; Learning an LDS with EM.",
				topics: [
					"Updating Gaussian beliefs",
					"A one-dimensional example",
					"Inference in linear dynamical systems",
					"Learning an LDS with EM",
				],
				slug: "kalman-filter",
			},
			{
				num: "6.17",
				title: "Dynamic Bayesian Networks & Particle Filters",
				summary:
					"Constructing dynamic Bayesian networks; Exact inference in DBNs; Sampling-importance-resampling; Particle filtering.",
				topics: [
					"Constructing dynamic Bayesian networks",
					"Exact inference in DBNs",
					"Sampling-importance-resampling",
					"Particle filtering",
				],
				slug: "dbns-particle-filters",
			},
			{
				num: "6.18",
				title: "Learning Bayesian Networks: Hidden Variables & Structure",
				summary:
					"Parameter learning with complete data (recap); Learning parameters with hidden variables; Learning structure: score-based search; Learning structure with hidden variables.",
				topics: [
					"Parameter learning with complete data",
					"Learning parameters with hidden variables",
					"Learning structure",
					"Learning structure with hidden variables",
				],
				slug: "learning-bayes-nets",
			},
			{
				num: "6.19",
				title: "Learning Undirected Graphical Models: Graphical Lasso & Ising",
				summary:
					"Gaussian graphical models and partial correlations; Estimating parameters when the graph is known; Estimating the graph: the graphical lasso; Discrete undirected models: estimation with a known graph.",
				topics: [
					"Gaussian graphical models and partial",
					"Estimating parameters when the graph is",
					"Estimating the graph",
					"Discrete undirected models",
				],
				slug: "learning-undirected-models",
			},
			{
				num: "6.20",
				title: "Causal Networks: Interventions & the Back-door Criterion",
				summary:
					"Correlation versus causation; Simpson's paradox; Causal Bayesian networks; Representing actions with the do-operator; The back-door criterion and adjustment.",
				topics: [
					"Correlation versus causation",
					"Causal Bayesian networks",
					"Representing actions with the do-operator",
					"The back-door criterion and adjustment",
				],
				slug: "causal-inference",
			},
			{
				num: "6.21",
				title: "Probabilistic Programming & Open-Universe Models",
				summary:
					"Relational probability models: syntax, semantics and inference; Rating player skill; Open-universe models: syntax, semantics, inference; Multitarget tracking and traffic monitoring.",
				topics: [
					"Relational probability models",
					"Rating player skill",
					"Open-universe models",
					"Multitarget tracking and traffic",
				],
				slug: "probabilistic-programming",
			},
			{
				num: "6.22",
				title: "Energy-Based Models & the Partition Function",
				summary:
					"Energy-based models and the partition function; The log-likelihood gradient: positive and negative phase; Stochastic maximum likelihood and contrastive divergence; Pseudolikelihood.",
				topics: [
					"Energy-based models and the partition",
					"The log-likelihood gradient",
					"Stochastic maximum likelihood and",
					"Pseudolikelihood",
				],
				slug: "energy-based-models",
			},
			{
				num: "6.23",
				title: "Boltzmann Machines & Restricted Boltzmann Machines",
				summary:
					"Boltzmann machines; The deep-learning approach to structured models; RBMs: conditional distributions; Training RBMs with contrastive divergence.",
				topics: [
					"Boltzmann machines",
					"The deep-learning approach to structured",
					"RBMs",
					"Training RBMs with contrastive divergence",
				],
				slug: "boltzmann-machines-rbms",
			},
			{
				num: "6.24",
				title: "Deep Belief Networks & Deep Boltzmann Machines",
				summary:
					"Deep belief networks; Deep Boltzmann machines and their properties; Mean-field inference and parameter learning in DBMs; Layer-wise pretraining and joint training.",
				topics: [
					"Deep belief networks",
					"Deep Boltzmann machines and their",
					"Mean-field inference and parameter",
					"Layer-wise pretraining and joint training",
				],
				slug: "deep-belief-boltzmann",
			},
		],
	},
	{
		part: 7,
		id: "classical-ai",
		name: "Classical AI: Search, Logic & Planning",
		short: "CAI",
		blurb:
			"The symbolic side of AI: uninformed and heuristic search, games, constraint satisfaction, propositional and first-order logic, knowledge representation and classical planning.",
		lectures: [
			{
				num: "7.1",
				title: "Problem Solving by Search: BFS to Iterative Deepening",
				summary:
					"Search problems, solutions and formulation; Standardised and real-world problems; Best-first search, frontiers and redundant paths; Measuring performance and asymptotic analysis.",
				topics: [
					"Search problems, solutions and formulation",
					"Standardised and real-world problems",
					"Best-first search, frontiers and",
					"Measuring performance and asymptotic",
				],
				slug: "uninformed-search",
			},
			{
				num: "7.2",
				title: "Heuristic Search & Designing Heuristics",
				summary:
					"Greedy best-first search and search contours; Weighted A* and satisficing search; Memory-bounded search: IDA*, RBFS, SMA*; Bidirectional heuristic search.",
				topics: [
					"Greedy best-first search and search",
					"Weighted A* and satisficing search",
					"Memory-bounded search",
					"Bidirectional heuristic search",
				],
				slug: "heuristic-search",
			},
			{
				num: "7.3",
				title: "Local Search & Optimisation",
				summary:
					"Hill climbing and its failures; Simulated annealing; Local beam search; Evolutionary algorithms.",
				topics: [
					"Hill climbing and its failures",
					"Simulated annealing",
					"Local beam search",
					"Evolutionary algorithms",
				],
				slug: "local-search",
			},
			{
				num: "7.4",
				title: "Search with Nondeterminism, Partial Observation & Unknown Worlds",
				summary:
					"Nondeterministic actions and AND-OR search; Cyclic plans: try, try again; Searching with no observation: belief states; Partially observable problems and agents.",
				topics: [
					"Nondeterministic actions and AND-OR search",
					"Cyclic plans",
					"Searching with no observation",
					"Partially observable problems and agents",
				],
				slug: "search-under-uncertainty",
			},
			{
				num: "7.5",
				title: "Adversarial Search: Minimax & Alpha-Beta",
				summary:
					"Two-player zero-sum games; Minimax and multiplayer games; Alpha-beta pruning and move ordering; Evaluation functions and cutting off search.",
				topics: [
					"Two-player zero-sum games",
					"Minimax and multiplayer games",
					"Alpha-beta pruning and move ordering",
					"Evaluation functions and cutting off",
				],
				slug: "adversarial-search",
			},
			{
				num: "7.6",
				title: "Games of Chance & Imperfect Information",
				summary:
					"Stochastic games and expectiminimax; Evaluation functions for games of chance; Partially observable games: Kriegspiel; Card games and belief over hands.",
				topics: [
					"Stochastic games and expectiminimax",
					"Evaluation functions for games of chance",
					"Partially observable games",
					"Card games and belief over hands",
				],
				slug: "stochastic-imperfect-games",
			},
			{
				num: "7.7",
				title: "Constraint Satisfaction: Formulation & Propagation",
				summary:
					"CSPs: map colouring and job-shop scheduling; Variations on the formalism; Node, arc and path consistency; k-consistency and global constraints.",
				topics: [
					"CSPs",
					"Variations on the formalism",
					"Node, arc and path consistency",
					"k-consistency and global constraints",
				],
				slug: "csp-propagation",
			},
			{
				num: "7.8",
				title: "Constraint Satisfaction: Backtracking, Local Search & Structure",
				summary:
					"Backtracking with variable and value ordering; Interleaving search and inference: forward checking, MAC; Backjumping and constraint learning; Min-conflicts local search.",
				topics: [
					"Backtracking with variable and value",
					"Interleaving search and inference",
					"Backjumping and constraint learning",
					"Min-conflicts local search",
				],
				slug: "csp-search",
			},
			{
				num: "7.9",
				title: "Logical Agents & Propositional Logic",
				summary:
					"Knowledge-based agents and the Wumpus world; Logic: models, entailment and inference; Propositional syntax, semantics and a simple knowledge base; Inference by model checking.",
				topics: [
					"Knowledge-based agents and the Wumpus",
					"Logic",
					"Propositional syntax, semantics and a",
					"Inference by model checking",
				],
				slug: "propositional-logic",
			},
			{
				num: "7.10",
				title: "SAT Solving & Logical Agents",
				summary:
					"NP-completeness and why SAT matters; DPLL: a complete backtracking algorithm; WalkSAT and local search; The phase transition in random SAT.",
				topics: [
					"NP-completeness and why SAT matters",
					"DPLL",
					"WalkSAT and local search",
					"The phase transition in random SAT",
				],
				slug: "sat-logical-agents",
			},
			{
				num: "7.11",
				title: "First-Order Logic",
				summary:
					"Why first-order: objects, relations, functions; Models, symbols, interpretations and terms; Atomic and complex sentences, quantifiers and equality; Database semantics.",
				topics: [
					"Why first-order",
					"Models, symbols, interpretations and terms",
					"Atomic and complex sentences, quantifiers",
					"Database semantics",
				],
				slug: "first-order-logic",
			},
			{
				num: "7.12",
				title: "Inference in FOL: Unification, Chaining & Logic Programming",
				summary:
					"Reduction to propositional inference; Unification, storage and retrieval; Forward chaining over definite clauses and efficient matching; Backward chaining.",
				topics: [
					"Reduction to propositional inference",
					"Unification, storage and retrieval",
					"Forward chaining over definite clauses",
					"Backward chaining",
				],
				slug: "fol-chaining-prolog",
			},
			{
				num: "7.13",
				title: "Resolution Theorem Proving",
				summary:
					"Conjunctive normal form for FOL and Skolemisation; The resolution rule; Example proofs; Completeness of resolution.",
				topics: [
					"Conjunctive normal form for FOL and",
					"The resolution rule",
					"Example proofs",
					"Completeness of resolution",
				],
				slug: "resolution-theorem-proving",
			},
			{
				num: "7.14",
				title: "Knowledge Representation & Ontologies",
				summary:
					"Ontological engineering and upper ontologies; Categories, composition, measures, things and stuff; Events, time and fluents; Mental objects and modal logics.",
				topics: [
					"Ontological engineering and upper",
					"Categories, composition, measures, things",
					"Events, time and fluents",
					"Mental objects and modal logics",
				],
				slug: "knowledge-representation",
			},
			{
				num: "7.15",
				title: "Classical Planning",
				summary:
					"PDDL: air cargo, spare tyre and blocks world; Forward state-space search; Backward (regression) search; Planning as Boolean satisfiability.",
				topics: [
					"PDDL",
					"Forward state-space search",
					"Backward search",
					"Planning as Boolean satisfiability",
				],
				slug: "classical-planning",
			},
			{
				num: "7.16",
				title: "Hierarchical, Contingent & Scheduled Planning",
				summary:
					"High-level actions and hierarchical task networks; Searching for primitive and abstract solutions; Sensorless and contingent planning; Online planning and replanning.",
				topics: [
					"High-level actions and hierarchical task",
					"Searching for primitive and abstract",
					"Sensorless and contingent planning",
					"Online planning and replanning",
				],
				slug: "hierarchical-contingent-planning",
			},
		],
	},
	{
		part: 8,
		id: "speech",
		name: "Speech",
		short: "SPC",
		blurb:
			"How machines hear and talk: phonetics and acoustic features, speech recognition from HMMs to end-to-end models, and text-to-speech.",
		lectures: [
			{
				num: "8.1",
				title: "Phonetics & Prosody",
				summary:
					"Speech sounds and phonetic transcription (IPA, ARPAbet); Articulatory phonetics; Prosody; Prominence: accent, stress and schwa.",
				topics: [
					"Speech sounds and phonetic transcription",
					"Articulatory phonetics",
					"Prosody",
					"Prominence",
				],
				slug: "phonetics-prosody",
			},
			{
				num: "8.2",
				title: "From Waveform to Log-Mel & MFCC Features",
				summary:
					"Waves, frequency, amplitude, pitch and loudness; Reading phones from a waveform; Spectra and the source-filter model; Sampling, quantisation and windowing.",
				topics: [
					"Waves, frequency, amplitude, pitch and",
					"Reading phones from a waveform",
					"Spectra and the source-filter model",
					"Sampling, quantisation and windowing",
				],
				slug: "speech-features",
			},
			{
				num: "8.3",
				title: "Speech Recognition: Encoder-Decoder ASR, CTC & WER",
				summary:
					"The ASR task and its history; Encoder-decoder ASR: input and convolutional layers, inference, learning; CTC inference and training; Combining CTC and attention; RNN-T for streaming.",
				topics: [
					"The ASR task and its history",
					"Encoder-decoder ASR",
					"CTC inference and training",
					"Combining CTC and attention",
				],
				slug: "speech-recognition",
			},
			{
				num: "8.4",
				title: "Audio Tokens: HuBERT, EnCodec & Vector Quantisation",
				summary:
					"Self-supervised speech models: HuBERT forward pass and learning; Codecs for discrete audio tokens; The EnCodec encoder and decoder; Vector quantisation and residual VQ.",
				topics: [
					"Self-supervised speech models",
					"Codecs for discrete audio tokens",
					"The EnCodec encoder and decoder",
					"Vector quantisation and residual VQ",
				],
				slug: "audio-tokens",
			},
			{
				num: "8.5",
				title: "Text-to-Speech & Spoken Language Models",
				summary:
					"The TTS pipeline; VALL-E: generating audio with a two-stage LM; TTS evaluation: MOS and intelligibility; Other speech tasks.",
				topics: [
					"The TTS pipeline",
					"VALL-E",
					"TTS evaluation",
					"Other speech tasks",
				],
				slug: "text-to-speech",
			},
		],
	},
	{
		part: 9,
		id: "linguistic-structure",
		name: "Linguistic Structure",
		short: "LNG",
		blurb:
			"The structure inside language: tagging, grammars and parsing, dependency structure, meaning and semantic roles, coreference, discourse and dialogue.",
		lectures: [
			{
				num: "9.1",
				title: "Parts of Speech, Named Entities & CRFs",
				summary:
					"The map of natural-language tasks; Word classes and part-of-speech tagging; Named entities and BIO tagging; Conditional random fields: features, inference, training.",
				topics: [
					"The map of natural-language tasks",
					"Word classes and part-of-speech tagging",
					"Named entities and BIO tagging",
					"Conditional random fields",
				],
				slug: "pos-ner-crf",
			},
			{
				num: "9.2",
				title: "Word Senses, WordNet & Disambiguation",
				summary:
					"Lexical semantics; defining and counting senses; Relations between senses; WordNet and its sense relations; WSD with contextual embeddings.",
				topics: [
					"Lexical semantics",
					"Relations between senses",
					"WordNet and its sense relations",
					"WSD with contextual embeddings",
				],
				slug: "word-senses",
			},
			{
				num: "9.3",
				title: "Constituency & Context-Free Grammars",
				summary:
					"Constituency and BNF; Context-free grammars: formal definition; Grammar rules for English: sentences, NPs, VPs, coordination; The lexicon.",
				topics: [
					"Constituency and BNF",
					"Context-free grammars",
					"Grammar rules for English",
					"The lexicon",
				],
				slug: "constituency-grammars",
			},
			{
				num: "9.4",
				title: "CKY & Neural Constituency Parsing",
				summary:
					"CKY: dynamic programming over spans; Conversion to Chomsky normal form; CKY recognition, parsing and practice; Span-based neural constituency parsing.",
				topics: [
					"CKY",
					"Conversion to Chomsky normal form",
					"CKY recognition, parsing and practice",
					"Span-based neural constituency parsing",
				],
				slug: "constituency-parsing",
			},
			{
				num: "9.5",
				title: "Probabilistic Parsing: PCFGs & Lexicalisation",
				summary:
					"PCFGs for disambiguation and language modelling; Probabilistic CKY; Learning rule probabilities from a treebank; Problems: independence assumptions and lexical dependencies.",
				topics: [
					"PCFGs for disambiguation and language",
					"Probabilistic CKY",
					"Learning rule probabilities from a",
					"Problems",
				],
				slug: "pcfg-parsing",
			},
			{
				num: "9.6",
				title: "Combinatory Categorial Grammar",
				summary:
					"CCG categories and the lexicon; Combinatory rules; CCGbank; Ambiguity in CCG.",
				topics: [
					"CCG categories and the lexicon",
					"Combinatory rules",
					"CCGbank",
					"Ambiguity in CCG",
				],
				slug: "ccg",
			},
			{
				num: "9.7",
				title: "Dependency Parsing: Transition- & Graph-Based",
				summary:
					"Dependency relations, formalisms and projectivity; Dependency treebanks; Transition-based parsing and the oracle; Feature-based and neural classifiers.",
				topics: [
					"Dependency relations, formalisms and",
					"Dependency treebanks",
					"Transition-based parsing and the oracle",
					"Feature-based and neural classifiers",
				],
				slug: "dependency-parsing",
			},
			{
				num: "9.8",
				title: "Semantic Roles: PropBank, FrameNet & SRL",
				summary:
					"Semantic roles and diathesis alternations; Problems with thematic roles; PropBank and FrameNet; Feature-based and neural SRL, with evaluation.",
				topics: [
					"Semantic roles and diathesis alternations",
					"Problems with thematic roles",
					"PropBank and FrameNet",
					"Feature-based and neural SRL, with",
				],
				slug: "semantic-roles",
			},
			{
				num: "9.9",
				title: "Meaning Representations & Semantic Parsing",
				summary:
					"Computational desiderata for meaning representations; Model-theoretic semantics; Lambda notation and compositional semantics; Event and state representations.",
				topics: [
					"Computational desiderata for meaning",
					"Model-theoretic semantics",
					"Lambda notation and compositional",
					"Event and state representations",
				],
				slug: "semantic-parsing",
			},
			{
				num: "9.10",
				title: "Information Extraction: Relations, Events & Entity Linking",
				summary:
					"Relation extraction with patterns; Supervised, bootstrapped and distantly supervised extraction; Unsupervised extraction and evaluation; Extracting events.",
				topics: [
					"Relation extraction with patterns",
					"Supervised, bootstrapped and distantly",
					"Unsupervised extraction and evaluation",
					"Extracting events",
				],
				slug: "information-extraction",
			},
			{
				num: "9.11",
				title: "Time, Aspect & Template Filling",
				summary:
					"Representing time; Reichenbach's reference point; Aspect; TimeBank; Extracting and normalising temporal expressions.",
				topics: [
					"Representing time",
					"Aspect",
					"TimeBank",
					"Extracting and normalising temporal",
				],
				slug: "time-and-templates",
			},
			{
				num: "9.12",
				title: "Sentiment, Affect & Connotation Lexicons",
				summary:
					"Defining emotion; Available sentiment and affect lexicons; Building lexicons by human labelling; Semi-supervised induction: semantic axes and label propagation.",
				topics: [
					"Defining emotion",
					"Available sentiment and affect lexicons",
					"Building lexicons by human labelling",
					"Semi-supervised induction",
				],
				slug: "sentiment-lexicons",
			},
			{
				num: "9.13",
				title: "Coreference Resolution",
				summary:
					"Referring expressions and information status; Non-referring expressions and properties of coreference; Tasks, datasets and mention detection; Mention-pair, mention-rank and entity-based architectures.",
				topics: [
					"Referring expressions and information",
					"Non-referring expressions and properties",
					"Tasks, datasets and mention detection",
					"Mention-pair, mention-rank and",
				],
				slug: "coreference",
			},
			{
				num: "9.14",
				title: "Discourse Coherence",
				summary:
					"Coherence relations: RST and the PDTB; Discourse parsing: EDU segmentation, RST, PDTB; Centering and the entity grid; Neural local coherence models.",
				topics: [
					"Coherence relations",
					"Discourse parsing",
					"Centering and the entity grid",
					"Neural local coherence models",
				],
				slug: "discourse-coherence",
			},
			{
				num: "9.15",
				title: "Conversation & Frame-Based Dialogue",
				summary:
					"Turns, speech acts and grounding; Subdialogues, initiative, inference and implicature; Dialogue acts and corpora; Frames, slots and dialogue-state tracking.",
				topics: [
					"Turns, speech acts and grounding",
					"Subdialogues, initiative, inference and",
					"Dialogue acts and corpora",
					"Frames, slots and dialogue-state tracking",
				],
				slug: "dialogue",
			},
		],
	},
	{
		part: 10,
		id: "robotics",
		name: "Robotics",
		short: "ROB",
		blurb:
			"AI with a body: perception, localisation and mapping, motion planning and control, and learning to act in the physical world.",
		lectures: [
			{
				num: "10.1",
				title: "Robots, Sensors & Localisation",
				summary:
					"What robots are: manipulators, mobile robots, hardware types; Sensing the world and producing motion; What problem robotics solves; Localisation and mapping (SLAM).",
				topics: [
					"What robots are",
					"Sensing the world and producing motion",
					"What problem robotics solves",
					"Localisation and mapping",
				],
				slug: "robots-sensors-localisation",
			},
			{
				num: "10.2",
				title: "Motion Planning & Control",
				summary:
					"Configuration space; Motion planning: visibility graphs, cell decomposition, RRT; Trajectory tracking: P, PD, PID; Optimal control and LQR.",
				topics: [
					"Configuration space",
					"Motion planning",
					"Trajectory tracking",
					"Optimal control and LQR",
				],
				slug: "motion-planning-control",
			},
			{
				num: "10.3",
				title: "Robot Learning & Humans with Robots",
				summary:
					"Reinforcement learning in robotics: exploiting models; Exploiting other information: demonstrations; Coordinating with humans; Learning to do what humans want.",
				topics: [
					"Reinforcement learning in robotics",
					"Exploiting other information",
					"Coordinating with humans",
					"Learning to do what humans want",
				],
				slug: "robot-learning-hri",
			},
		],
	},
	{
		part: 11,
		id: "ai-engineering",
		name: "AI Engineering",
		short: "ENG",
		blurb:
			"Shipping foundation models: evaluation pipelines, dataset engineering, inference optimisation, serving architecture and user feedback.",
		lectures: [
			{
				num: "11.1",
				title: "From Foundation Models to Products: Use Cases & Planning",
				summary:
					"The rise of AI engineering; from LLMs to foundation models; Applications of LLMs; Use cases: coding, media, writing, education, bots; Information aggregation, data organisation, workflow automation.",
				topics: [
					"The rise of AI engineering",
					"Applications of LLMs",
					"Use cases",
					"Information aggregation, data",
				],
				slug: "ai-use-cases-planning",
			},
			{
				num: "11.2",
				title: "The AI Engineering Stack, Model Selection & Build vs Buy",
				summary:
					"Three layers of the AI stack; AI engineering versus ML and full-stack engineering; The model-selection workflow; Build versus buy: open versus API models.",
				topics: [
					"Three layers of the AI stack",
					"AI engineering versus ML and full-stack",
					"The model-selection workflow",
					"Build versus buy",
				],
				slug: "ai-stack-model-selection",
			},
			{
				num: "11.3",
				title: "Evaluating AI Systems: Criteria & an Evaluation Pipeline",
				summary:
					"Why foundation models are hard to evaluate; their probabilistic nature; Criteria: domain capability, generation, instruction following; Navigating public benchmarks; Evaluate every component of a system.",
				topics: [
					"Why foundation models are hard to evaluate",
					"Criteria",
					"Navigating public benchmarks",
					"Evaluate every component of a system",
				],
				slug: "evaluation-pipeline",
			},
			{
				num: "11.4",
				title: "Production Architecture: Guardrails, Routers, Gateways & Observability",
				summary:
					"The architecture, step by step; Guardrails on input and output; Model routers and gateways; Monitoring and observability.",
				topics: [
					"The architecture, step by step",
					"Guardrails on input and output",
					"Model routers and gateways",
					"Monitoring and observability",
				],
				slug: "production-architecture",
			},
			{
				num: "11.5",
				title: "User Feedback & the Data Flywheel",
				summary:
					"Extracting conversational feedback; Designing feedback: when and how to ask; Feedback limitations and biases; Closing the loop: from feedback to training data.",
				topics: [
					"Extracting conversational feedback",
					"Designing feedback",
					"Feedback limitations and biases",
					"Closing the loop",
				],
				slug: "user-feedback-flywheel",
			},
		],
	},
	{
		part: 12,
		id: "ai-society",
		name: "AI & Society",
		short: "SOC",
		blurb:
			"The book's close: the philosophy of AI, its ethics, fairness and harms, and where the field may go next.",
		lectures: [
			{
				num: "12.1",
				title: "Bias & Harms in Language Technology",
				summary:
					"Anthropomorphism and terminology; Avoiding harms in classification; Bias in embeddings; Bias and ethics in machine translation.",
				topics: [
					"Anthropomorphism and terminology",
					"Avoiding harms in classification",
					"Bias in embeddings",
					"Bias and ethics in machine translation",
				],
				slug: "bias-and-harms",
			},
			{
				num: "12.2",
				title: "Ethics & Safety of AI",
				summary:
					"Beneficial machines and the risks and benefits of AI; Lethal autonomous weapons; Surveillance, security and privacy; The future of work.",
				topics: [
					"Beneficial machines and the risks and",
					"Lethal autonomous weapons",
					"Surveillance, security and privacy",
					"The future of work",
				],
				slug: "ai-ethics-safety",
			},
			{
				num: "12.3",
				title: "Philosophy & the Future of AI",
				summary:
					"The limits of AI: informality, disability, the mathematical objection; Measuring AI; Can machines really think? The Chinese room; Consciousness and qualia.",
				topics: [
					"The limits of AI",
					"Measuring AI",
					"Can machines really think? The Chinese",
					"Consciousness and qualia",
				],
				slug: "philosophy-future-ai",
			},
		],
	},
];
