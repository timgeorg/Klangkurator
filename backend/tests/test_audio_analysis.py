"""The metrical-level test in `analyze_track` (issue #66).

`beat_track` reads one half, two thirds or two fifths of the real tempo on part
of this library. The sub-multiple is a genuine autocorrelation harmonic, so the
repair cannot be "which grid fits the onsets better" — it is `_metrical_level`,
which measures the detected period in pulses and snaps a 3- or 4-pulse claim to
two.

Two groups of tests:

- the pure-function tests build their input, so they run in CI;
- the per-track expectations need the real audio on the external drive and are
  skipped when the files are absent (CI has no drive).
"""

import os

import librosa
import numpy as np
import pytest

from backend.scanner import audio_analysis

SR = 22050
HOP = audio_analysis.HOP_LENGTH
FPS = SR / HOP

MUSIC = "/media/tim/Extreme SSD/#MUSIC/"

# (label, path, the tempo a DJ would read)
EXPECTED = [
    ("Bitch", MUSIC + "house/tims-house-2-party-picks/"
     "Bitch Don't Kill My Vibe (Darren After Edit) - Kendrick Lamar.mp3", 129.2),
    ("LoveRight", MUSIC + "house/tims-house-2-party-picks/Love The Right Way.mp3", 129.2),
    ("MakeBelieve", MUSIC + "house/tims-house-2-party-picks/"
     "Luke Dean & Omar + - Make Believe.mp3", 129.2),
    ("Crazy", MUSIC + "house/tims-tech-house-picks/"
     "Gnarls Barkley - Crazy (WeDamnz VIP Edit).mp3", 129.2),
    ("PonQash", MUSIC + "house/tims-tech-house-picks/"
     "Rihanna - Pon De Replay (Qash Extended Remix) [Tech House].mp3", 129.2),
    ("Stranger", MUSIC + "event/tims-halloween-specials/"
     "Kids - Stranger Things Vol. 1.mp3", 60.1),
    ("PonTechno", MUSIC + "techno/tims-techno-remix-picks/Pon De Replay.mp3", 136.0),
    ("CrazyInLove", MUSIC + "pop/10yeardancerobix/Crazy In Love (feat. JAY-Z).mp3", 99.4),
]


def _click_envelope(period_s: float, seconds: float = 30.0, seed: int = 0) -> np.ndarray:
    """A pulse train at `period_s`, as an onset envelope rather than audio.

    `_metrical_level` only reads the envelope, so this exercises the rule itself
    without synthesising and decoding a wav — and without the decoder's own
    rounding, which would blur what the test is pinning.
    """
    rng = np.random.default_rng(seed)
    env = np.zeros(int(seconds * FPS))
    period = period_s * (1.0 + rng.uniform(-0.01, 0.01, int(seconds / period_s) + 2))
    for t in 0.15 + np.cumsum(period):
        index = int(round(t * FPS))
        if index < len(env):
            env[index] = 1.0
    return np.convolve(env, np.exp(-np.arange(6) / 2.0), mode="same")


@pytest.fixture
def pulse():
    """The 8th-note pulse of the tracks a DJ reads as 129.2 BPM."""
    return 60.0 / (2 * 129.2)


@pytest.mark.parametrize(
    ("detected", "expected"),
    [
        (60.0 / 3.0 / 0.2322, 129.2),   # three pulses per beat -> the beat
        (60.0 / 4.0 / 0.2322, 129.2),   # four pulses per beat  -> the beat
    ],
)
def test_a_three_or_four_pulse_claim_is_snapped_to_two(pulse, detected, expected):
    env = _click_envelope(pulse)
    assert audio_analysis._metrical_level(detected, env, librosa, np, SR) == pytest.approx(
        expected, abs=2.0
    )


def test_a_two_pulse_claim_is_left_alone(pulse):
    """The level the detector gets right must not move."""
    env = _click_envelope(pulse)
    detected = 2 * 60.0 / (2 * pulse)   # exactly two pulses per beat
    assert audio_analysis._metrical_level(detected, env, librosa, np, SR) == pytest.approx(
        detected
    )


def test_a_slow_pulse_with_no_sub_beat_is_left_alone():
    """AC-4: a genuinely slow track has no sub-beat pulse to snap onto.

    This is the case the rejected 120-145 prior broke — it turned this into
    129.2. The rule must answer 60.
    """
    env = _click_envelope(60.0 / 60.1)
    assert audio_analysis._metrical_level(60.1, env, librosa, np, SR) == pytest.approx(60.1)


def test_an_empty_envelope_is_not_moved():
    """Silence has no pulses; the detection (0.0) has to survive so the caller
    can treat it as a failed detection rather than a tempo."""
    assert audio_analysis._metrical_level(0.0, np.zeros(4096), librosa, np, SR) == 0.0


def test_the_pulse_is_the_sub_beat_interval_not_the_beat(pulse):
    env = _click_envelope(pulse)
    assert audio_analysis._pulse_period(env, librosa, np, SR) == pytest.approx(
        pulse, rel=0.02
    )


@pytest.mark.skipif(
    not all(os.path.exists(path) for _, path, _ in EXPECTED),
    reason="needs the real audio on the external drive",
)
@pytest.mark.parametrize(("label", "path", "expected"), EXPECTED,
                         ids=[label for label, _, _ in EXPECTED])
def test_analyze_track_returns_the_level_a_dj_would_read(label, path, expected):
    """The five mis-reads and the three correct tracks, through `analyze_track`.

    Both halves are asserted together on purpose: a rule that "fixes" the five
    by shifting everything breaks AC-4, and that is the failure this test is
    here to catch.
    """
    result = audio_analysis.analyze_track(path)
    assert result["bpm"] == pytest.approx(expected, abs=2.0)
