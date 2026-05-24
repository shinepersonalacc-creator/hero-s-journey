export const chapters = [
  {
    level: 1,
    title: "Ordinary World",
    description:
      "Greetings traveler! I see that you have a long way to go, every great adventure begins with a single step, and your first step starts here. It's time to cross the meadows that you've known your whole life to reach your truest potential.",
  },
  {
    level: 2,
    title: "Call to Adventure",
    description:
      "The path is starting to look a bit unfamiliar isn't it? When you turn back, you can still look at your cottage, so you know you're not too far from home. It is up to you to remain where the world feels safe and known, or press onward into the unknown that lies ahead.",
  },
  {
    level: 3,
    title: "New faces",
    description:
      "You are finally far enough - you meet new people who might shape you, a few who might challenge you. It's up to you to choose your allies wisely, and respond to adversity with courage. You have made it this far might as well reach the flag point.",
  },
  {
    level: 4,
    title: "Crossing the Threshold",
    description:
      "You've finally made it to the big city. It's cold, it gets hot at times - people have their guard up in bigger cities, staying focused on your path ahead no longer seems easier because there are too many opinions clouding your judgement. Too many distractions - and many people fall prey to distractions - will you join them or can you escape the temptation?",
  },
  {
    level: 5,
    title: "Choosing battles",
    description:
      "You hear whispers - you read the pamphlets, you are now a part of society and know that the world is filled with unimaginable horrors - deadly plagues, taxes, war and inflation. Sometimes it feels like - nothing is worth fighting for. It is easy for one to lose hope at this stage. But when you look back - you see how far you've come, a part of you is curious about how far you can go from here...",
  },
  {
    level: 6,
    title: "The Wayfinder",
    description:
      "We meet again traveller! You are halfway there. You know now despite the many existential horrors out there in the world - there is a certain beauty to it too. People who find a glimmer of hope, a silver lining. You realize then that to truly experience life, is to just live it, to move forward - and that is what you'll do.",
  },
  {
    level: 7,
    title: "Answering the call",
    description:
      "You are at a very crucial point! Looking back now, you realize all the hurdles you crossed, all the battles you've won, all the time you've proved yourself wrong. Even though you stumbled you picked yourself up and kept going and this is where you are now. You are no longer afraid of trying new things which is exactly why you boarded a ship to the great unknown.",
  },
  {
    level: 8,
    title: "trials and blockades",
    description:
      "Hey there traveler! The path is no longer familiar, you can't see where you're headed. The monsters in the sea delay your journey don't mean to harm you - they are on their own path - just like you. The only thing you can do now is travel straight ahead. With your newfound wisdom, responsibilities, and scars earned along the way, you are no longer the same traveler who first stepped beyond the meadow.",
  },
  {
    level: 9,
    title: "storming through the ordeal",
    description:
      "You are much closer to your destination now, compared to when you started, this is also the time when one faces a lot of internal battles than you started. You have shifted your benchmark for you higher and higher - just as you discovered that you have the strengths needed to face those challenges. I am proud of how far you have come.",
  },
  {
    level: 10,
    title: "transformation",
    description:
      "The path to the top is always lonely - the path ahead is clouded and cold, but you know now that this is the path you need to take if you want to reach the destination. You remember all the new experiences you had, just because you made a decision to take the first step. You can see the flag just over the horizon, even though the path is longer and twisted - you have committed to the journey and closer to the finish line than ever before.",
  },
] as const;

export function getChapterInfo(level: number) {
  const chapterLevel = Math.min(Math.max(Math.round(level), 1), chapters.length);
  const chapter = chapters[chapterLevel - 1];

  return {
    ...chapter,
    label: `Chapter ${chapter.level} : ${chapter.title}`,
    image: `/Image/level ${chapter.level}.png`,
  };
}

export function getChapterBackgroundImage(level: number) {
  const chapter = getChapterInfo(level);

  return [
    `url('${chapter.image}')`,
    `url('/Image/level${chapter.level}.png')`,
    `url('/Image/lvl${chapter.level}.png')`,
    `url('/Image/lvl ${chapter.level}.png')`,
    "url('/Image/adventurebg.png')",
  ].join(", ");
}

export function getChapterBackgroundSize() {
  return "100% auto, 100% auto, 100% auto, 100% auto, 100% auto";
}

export function getChapterBackgroundRepeat() {
  return "repeat-y, repeat-y, repeat-y, repeat-y, repeat-y";
}
