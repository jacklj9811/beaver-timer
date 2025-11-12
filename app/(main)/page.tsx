import Timer from "@/components/Timer";
import TaskList from "@/components/TaskList";

export default function HomePage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">番茄计时</h2>
        <Timer />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">任务列表</h2>
        <TaskList />
      </section>
    </div>
  );
}
