// HUD prose in one place (voice review is one grep). Every line is true to the mechanic it names.

// unitStats: tol=hp, sal=ease dealt, lat=seconds between answers, reach=range, opa=% missed, lab=ease variance, rec=% double answer.
export const STAT_TEXT = {
  tol: 'How much may land on it before it leaves the circle.',
  sal: 'How much of a stressor each answer takes off.',
  lat: 'The breath between impulse and act. Smaller is louder.',
  reach: 'How far off a thing may be and still be its concern.',
  opa: 'The share of what arrives that finds no one there.',
  lab: 'How far an answer may stray from its usual weight, as a hand trembles, either way.',
  rec: 'The odds that one answer arrives as two, the second like an echo.',
};

// One section per stage, in STAGES order.
export const CODEX = [
  'Each time it is looked at, it gives a little affect, as a face warms to being seen. Looking is worth more as the self grows, as the waves go on, and once more for every ten that have passed.',
  'Five things arrive at a time. Attention brings them in, and the rarer cost more. What is brought in waits, eight at most, until it is given a place in the circle. Two of the same, at the same link, are one thing a link higher. Once something is held, waves come on their own: ten beats of stressors through ten gates. Holding pays attention, a little more for a run of holding and for attention left unspent.',
  'A habit costs a little more each time it is taken up, and then produces affect without being asked, like a window left lit. The ways open over time; each one bends a rule rather than adding a number.',
  'Two can be joined into one shape, the way two hands become a cup. The shape is named for its heaviest part, keeps the higher link, and carries traits from both. A shape holds six parts at most; the lightest falls away and remains only as a ghost.',
  'Anything can stop being a thing and become a habit. Its first part decides which habit. Its tier, its link and its parts decide how many.',
  'Insight gathers on its own, faster with each level, up to a hundred. It pays for joining, for cutting apart, and for three small spells.',
  'What was joined can be opened at its seam, for a little insight. Something whole but further along opens into its two poles, one link lower.',
  'A second ring opens outside the first, like a wider shore. There are more places now, but no more may be held at once than before.',
  'One can be carved out of another. The first keeps its link and all of its traits, takes one trait from the second, and is hollow where the second was.',
  'Others can be paid to attend. Each attends once a second at half the worth, and each costs a little more than twice the last.',
  'Four verbs, each holding one regulator for a while. Some want a particular aspect. They return insight, moods, composure, or something else that woke in its place.',
  'Affect, attention and insight can each be traded for another, at poor rates that follow the yield.',
  'Where a shape carries a second family, that family\'s ability now sounds as well, at half strength, each time the first one does.',
  'There are three ways to stand among others: toward, away, against. Each makes one thing stronger and another weaker. Standing at all adds to complexity.',
  'Every sixty seconds a season takes three attention. Where there are not three to take, it leaves a dread instead.',
  'The whole assembly can be reflected. Affect doubles, two more may be held, a third ring opens, and the stressors grow heavier. Each reflection costs twenty-five times the last.',
  'Every aspect now counts one member more than is seated.',
  'When complexity passes capacity far enough, composure drains, beats come faster and stressors swell. Letting go from there keeps twice the residue.',
];

export const CODEX_INTRO = 'What follows is accurate. It may not be useful until it has already happened.';

// The ask button's questions: the player's own voice, sincere and a little lost. Deliberately unrelated
// to the hint that pressing it brings (the owner's first four are kept as given).
export const QUESTIONS = [
  'Where am I?', 'Is this the beep beep?', 'Was the moment wrong?', 'Can I reach the sun?',
  'Who left this here?', 'Is it still Tuesday?', 'Does the water know?', 'Am I the small one?',
  'Is the door the same door?', 'Did I already say that?', 'Which way is down here?', 'Is anyone counting?',
  'Was it always this colour?', 'Can I keep the quiet part?', 'Is the bowl full or am I?', 'Where does the hum go at night?',
  'Is that my hand?', 'Should the ring be warm?', 'Who taught the waves to come back?', 'Am I early, or is the evening late?',
  'Is this the part where I wait?', 'Can a circle be tired?', 'Did the light move or did I?', 'What was I holding?',
  'Is there a smaller room inside?', 'Does the tide remember me?', 'Is it rude to stay until the light goes?', 'Why is the floor singing?',
  'Was there a first one?', 'Can I come back later?', 'Is the wind on my side?', 'Am I allowed to rest here?',
  'Which of these is mine?', 'Is the noise a kind of weather?', 'Did something just begin, softly, behind me?', 'Is the sky the lid?',
  'How long is a breath here?', 'Can I trade this for a softer one?', 'Is the stone listening?', 'Was that a yes?',
  'Are the edges asleep?', 'Do the gates know my name?', 'Is tonight the long one?', 'Where did the other one go, and is it cold there?',
];
