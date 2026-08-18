import { notFound } from "next/navigation";
import MealScene from "@/components/MealScene";
import { PERSONAS, getPersona } from "@/lib/personas";

export function generateStaticParams() {
  return PERSONAS.filter((p) => p.unlocked).map((p) => ({ id: p.id }));
}

export default async function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const persona = getPersona(id);
  if (!persona || !persona.unlocked) notFound();

  return <MealScene persona={persona} />;
}
