-- Adds a quiz column to article_content: two segments (grammar, comprehension)
-- of multiple-choice questions ranging from easy to hard. See src/lib/types.ts
-- (Quiz, QuizQuestion) and src/lib/lessonSchema.ts (quizJsonSchema) for the
-- expected shape:
--
-- {
--   "grammar": [
--     { "question": "string", "options": ["string","string","string","string"],
--       "correct_index": 0, "difficulty": "easy" | "medium" | "hard", "explanation": "string | null" }
--   ],
--   "comprehension": [ ...same shape... ]
-- }

alter table public.article_content
  add column if not exists quiz jsonb;
