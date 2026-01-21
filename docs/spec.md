# Quick Draw - Game Specification

A typing showdown game where you face off against an AI opponent in classic western duels. Type faster and more accurately to draw your gun first and win.

---

## Core Concept

Two stickmen cowboys face each other in a showdown. A word or phrase appears on screen after a countdown. Both players race to type it. As each character is typed correctly, the cowboy's arm raises (holding a gun). The first to complete the word fires their gun and wins.

---

## Game Flow

### 1. Pre-Duel
- Two stickmen stand facing each other, arms at their sides
- Countdown begins: **3... 2... 1... DRAW!**
- Fixed timing (predictable rhythm)

### 2. The Duel
- Word/phrase appears on screen at "DRAW!"
- Player and AI race to type the same word
- Arms raise progressively with each correct character
- **Typo handling**: Arm drops back proportionally (visual punishment)
- Player must backspace and correct to continue

### 3. Resolution
- First to complete the word fires their gun
- **Tie-breaker**: If completion times are within ~200ms, higher accuracy wins
- Quick text flash: "YOU WIN" or "YOU LOSE"
- Auto-continue to next round

### 4. Progression
- Win streak tracking (consecutive wins displayed)
- Difficulty escalates with each win

---

## Typing Mechanics

### Input Rules
- **False starts**: No penalty - input simply doesn't register until "DRAW!" appears
- **Typos**: Arm drops back; must backspace and correct
- **Same word**: Both player and AI type identical text (pure speed race)

### Arm Animation
- Arm starts at side (0% progress)
- Each correct character raises arm proportionally
- Full word completion = arm raised, gun pointed at opponent
- Typo = arm drops back (amount proportional to progress lost)

---

## AI Opponent

### Behavior
- Types the same word as the player
- **Always beatable** at any difficulty level
- Difficulty affects typing speed (WPM equivalent)
- Does NOT make artificial mistakes - just varies speed

### Difficulty Scaling
- Starts at accessible speed
- Increases with player's win streak
- Maximum difficulty is challenging but fair - skilled players can always win

---

## Word/Phrase System

### Generation
- Procedurally generated (not a fixed word list)
- Ensures variety and replayability

### Escalating Difficulty (Mixed)
As win streak increases, difficulty grows through multiple dimensions:

1. **Word length**: 3-letter → 5 → 8 → 12+ characters
2. **Word rarity**: Common → uncommon → obscure vocabulary
3. **Phrase complexity**: Single word → two words → full sentences
4. **Combined**: Higher streaks mix all factors

### Examples by Difficulty
- **Easy (streak 0-2)**: "cat", "run", "dog"
- **Medium (streak 3-5)**: "saloon", "revolver", "sunset"
- **Hard (streak 6-9)**: "quick brown", "dusty trail"
- **Expert (streak 10+)**: "the sheriff draws at dawn"

---

## Visual Design (Prototype)

### Style
- Basic shapes / stick figures (whatever's fastest to implement)
- Recognizable as cowboys (hats optional but nice)
- Clear visual feedback is priority

### Elements
- Two stickmen, mirrored, facing center
- Arms with guns (lines or simple shapes)
- Text display area for the word/phrase
- Countdown display
- Win streak counter
- Progress indicators (typed characters highlighted)

### States to Show
- Idle (arms down)
- Typing progress (arm raising)
- Typo recovery (arm dropping)
- Victory (arm raised, "bang" moment)
- Defeat (opponent wins)

---

## Audio (Deferred)

- **Prototype**: Silent
- **Future**: Gunshot SFX, countdown beeps, background music

---

## Technical Scope

### Prototype Definition of Done
**One playable duel working end-to-end:**
- Countdown appears and completes
- Word displays at "DRAW!"
- Player can type, arm animates
- AI opponent types, their arm animates
- Winner determined, feedback shown
- Can start another duel

### Out of Scope (Prototype)
- Sound effects
- Multiple game modes
- Unlockables/cosmetics
- Online multiplayer
- Settings/options menu
- Mobile support

---

## Tech Stack

- **Framework**: Vite (vanilla JS)
- **Rendering**: Canvas or DOM (implementer's choice)
- **Deployment**: Vercel

---

## Key Interactions

```
[Countdown]     →  "3"  →  "2"  →  "1"  →  "DRAW!"
                                            ↓
[Word Appears]  →  "revolver"
                                            ↓
[Player Types]  →  r → e → v → o → l → v → e → r
                   ↓   ↓   ↓   ↓   ↓   ↓   ↓   ↓
[Arm Position]  → 12% 25% 37% 50% 62% 75% 87% 100%
                                            ↓
[Shot Fired]    →  BANG!  →  "YOU WIN"  →  [Next Round]
```

---

## Questions Resolved

| Question | Decision |
|----------|----------|
| Tie handling | Accuracy tie-breaker |
| Game mode | Single-player vs AI |
| Typo consequence | Arm drops back |
| AI difficulty | Always beatable |
| Word source | Procedural, escalating |
| Progression | Win streak tracking |
| Word matching | Same word for both |
| Draw trigger | Fixed countdown |
| False starts | No penalty |
| Round end feedback | Quick text flash |
| Visual style | Basic shapes (fast) |
| Audio | Silent prototype |

---

## Success Criteria

The prototype succeeds if:
1. The typing → arm movement feels responsive and satisfying
2. The countdown builds appropriate tension
3. Win/lose outcome is immediately clear
4. A complete duel can be played from start to finish
5. The player wants to try "one more round"
