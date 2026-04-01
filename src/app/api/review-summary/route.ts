import { createClient } from "@/lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reviewId } = await request.json();
  if (!reviewId) {
    return Response.json({ error: "reviewId is required" }, { status: 400 });
  }

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .single();

  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  const reviewContent = [
    `Week of ${review.week_start_date}`,
    "",
    review.habits_snapshot
      ? `HABITS:\n${JSON.stringify(review.habits_snapshot, null, 0)}`
      : "",
    review.habit_reflection
      ? `Habit reflection: ${review.habit_reflection}`
      : "",
    review.goals_snapshot
      ? `GOALS:\n${JSON.stringify(review.goals_snapshot, null, 0)}`
      : "",
    review.goals_reflection
      ? `Goals reflection: ${review.goals_reflection}`
      : "",
    review.tasks_snapshot
      ? `TASKS:\n${JSON.stringify(review.tasks_snapshot, null, 0)}`
      : "",
    review.tasks_reflection
      ? `Tasks reflection: ${review.tasks_reflection}`
      : "",
    review.finance_snapshot
      ? `FINANCE:\n${JSON.stringify(review.finance_snapshot, null, 0)}`
      : "",
    review.finance_note ? `Finance note: ${review.finance_note}` : "",
    review.wins?.length
      ? `WINS: ${review.wins.filter(Boolean).join(", ")}`
      : "",
    review.challenges?.length
      ? `CHALLENGES: ${review.challenges.filter(Boolean).join(", ")}`
      : "",
    review.intentions?.length
      ? `INTENTIONS: ${review.intentions.filter(Boolean).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are Jakob's personal Life OS assistant. Generate a concise, encouraging weekly review summary. Highlight patterns, wins, and areas to watch. Be direct and practical. 2-3 short paragraphs max.`,
    messages: [
      {
        role: "user",
        content: `Here is my weekly review data. Write a summary:\n\n${reviewContent}`,
      },
    ],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text : "";

  await supabase
    .from("weekly_reviews")
    .update({ ai_summary: summary })
    .eq("id", reviewId);

  return Response.json({ summary });
}
