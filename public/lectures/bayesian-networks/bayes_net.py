"""A Bayesian network for rain, sprinkler and wet grass.

Run it with:  python bayes_net.py
Needs Python 3.8 or newer and nothing else (standard library only).
"""
import itertools
import random

# 1. The graph. Each variable lists its parents. ORDER is a topological
#    order: every parent comes before its children.
PARENTS = {
    "Rain": [],
    "Sprinkler": ["Rain"],
    "WetGrass": ["Sprinkler", "Rain"],
}
ORDER = ["Rain", "Sprinkler", "WetGrass"]

# 2. The conditional probability tables (CPTs). For each combination of
#    parent values we store P(variable = True | parents).
#    P(variable = False | parents) is 1 minus that number.
CPT = {
    "Rain": {(): 0.2},
    "Sprinkler": {(False,): 0.4, (True,): 0.01},
    "WetGrass": {
        (False, False): 0.0,   # no sprinkler, no rain
        (False, True): 0.8,    # rain only
        (True, False): 0.9,    # sprinkler only
        (True, True): 0.99,    # both
    },
}


def p_node(var, value, world):
    """P(var = value | the values of var's parents in world)."""
    key = tuple(world[p] for p in PARENTS[var])
    p_true = CPT[var][key]
    return p_true if value else 1.0 - p_true


def joint(world):
    """The factorisation: P(R, S, G) = P(R) * P(S | R) * P(G | S, R)."""
    p = 1.0
    for var in ORDER:
        p *= p_node(var, world[var], world)
    return p


def all_worlds():
    """Every assignment of True/False to the three variables (8 of them)."""
    for values in itertools.product([True, False], repeat=len(ORDER)):
        yield dict(zip(ORDER, values))


def query(target, evidence):
    """Exact P(target = True | evidence) by enumerating the joint table."""
    match = [w for w in all_worlds() if all(w[k] == v for k, v in evidence.items())]
    p_evidence = sum(joint(w) for w in match)
    p_both = sum(joint(w) for w in match if w[target])
    return p_both / p_evidence


def ancestral_sample(rng):
    """Draw one world: visit variables parents-first, flip a biased coin each."""
    world = {}
    for var in ORDER:
        p_true = p_node(var, True, world)
        world[var] = rng.random() < p_true
    return world


def estimate(target, evidence, n, seed=0):
    """Rejection sampling: draw n worlds, keep those that match the evidence."""
    rng = random.Random(seed)
    kept = hits = 0
    for _ in range(n):
        w = ancestral_sample(rng)
        if all(w[k] == v for k, v in evidence.items()):
            kept += 1
            hits += w[target]
    return hits / kept, kept


def noisy_or(q, leak, active):
    """P(effect = True) when each active cause i fires with probability q[i]."""
    p_off = 1.0 - leak
    for cause, on in active.items():
        if on:
            p_off *= 1.0 - q[cause]
    return 1.0 - p_off


if __name__ == "__main__":
    tf = lambda b: "T" if b else "F"

    print("The joint table, one product per row")
    print(" R S G   P(R)  P(S|R) P(G|S,R)   joint")
    total = 0.0
    for w in all_worlds():
        f = [p_node(v, w[v], w) for v in ORDER]
        p = joint(w)
        total += p
        print(f" {tf(w['Rain'])} {tf(w['Sprinkler'])} {tf(w['WetGrass'])}  "
              f"{f[0]:5.2f}  {f[1]:5.2f}  {f[2]:6.2f}   {p:.5f}")
    print(f" sum of all 8 rows = {total:.5f}")
    print()

    g = {"WetGrass": True}
    print("Exact answers by enumeration")
    print(f" P(WetGrass = T)                   = {query('WetGrass', {}):.4f}")
    print(f" P(Rain = T | WetGrass = T)        = {query('Rain', g):.4f}")
    print(f" P(Sprinkler = T | WetGrass = T)   = {query('Sprinkler', g):.4f}")
    print(f" P(Rain = T | WetGrass = T, S = T) = "
          f"{query('Rain', {'WetGrass': True, 'Sprinkler': True}):.4f}")
    print()

    exact = query("Rain", g)
    print("Ancestral sampling + rejection, estimating P(Rain = T | WetGrass = T)")
    print("       n    kept  estimate   error")
    for n in (100, 1_000, 10_000, 100_000):
        est, kept = estimate("Rain", g, n, seed=1)
        print(f" {n:7d} {kept:7d}   {est:.4f}  {est - exact:+.4f}")
    print()

    q = {"Rain": 0.8, "Sprinkler": 0.9}
    print("Noisy-OR for WetGrass: q_rain = 0.8, q_sprinkler = 0.9, leak = 0")
    print(" S R   noisy-OR   full CPT")
    for s, r in [(False, False), (False, True), (True, False), (True, True)]:
        p = noisy_or(q, 0.0, {"Rain": r, "Sprinkler": s})
        print(f" {tf(s)} {tf(r)}   {p:8.3f}   {CPT['WetGrass'][(s, r)]:8.3f}")
    print(" parameters: noisy-OR 3 (two q's and a leak), full CPT 4;"
          " with 10 parents: 11 vs 1024")
