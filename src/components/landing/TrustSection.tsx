const TrustSection = () => {
  const stats = [
    { value: "100k+", label: "Documents analysed" },
    { value: "20+", label: "Countries served" },
    { value: "8", label: "Languages supported" },
    { value: "24/7", label: "Support availability" },
  ];

  return (
    <section className="py-10 md:py-14 border-y border-border bg-card">
      <div className="container-width section-padding !py-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1">
                {s.value}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
