import { ArrowUpRight } from "lucide-react";

const projects = [
  {
    title: "Nexus Finance",
    category: "Fintech Platform",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    color: "from-primary/40 to-primary/10",
  },
  {
    title: "Bloom Studio",
    category: "Creative Agency",
    image: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=600&fit=crop",
    color: "from-secondary/40 to-secondary/10",
  },
  {
    title: "Echo Health",
    category: "Healthcare App",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop",
    color: "from-accent/40 to-accent/10",
  },
  {
    title: "Velocity Motors",
    category: "Automotive Brand",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
    color: "from-primary/40 to-secondary/10",
  },
];

const WorkSection = () => {
  return (
    <section id="work" className="section-padding relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] -translate-y-1/2" />
      
      <div className="container-width relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
          <div>
            <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
              Our Work
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold">
              Featured
              <span className="text-primary"> Projects</span>
            </h2>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
          >
            View All Projects
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>

        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {projects.map((project, index) => (
            <a
              key={index}
              href="#"
              className="group relative rounded-2xl overflow-hidden aspect-[4/3] block"
            >
              {/* Background Image */}
              <img
                src={project.image}
                alt={project.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />

              {/* Gradient Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t ${project.color} to-transparent opacity-60`} />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                <span className="text-primary text-sm font-medium mb-2">
                  {project.category}
                </span>
                <h3 className="text-2xl md:text-3xl font-display font-bold group-hover:text-primary transition-all duration-300">
                  {project.title}
                </h3>
              </div>

              {/* Hover Arrow */}
              <div className="absolute top-6 right-6 w-12 h-12 rounded-full bg-foreground/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorkSection;
