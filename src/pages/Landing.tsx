import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Bot, Clock, Shield, ArrowRight, Sparkles, CheckCircle, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Landing = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: FileText,
      title: "Similarity Detection",
      description: "Documents checked against billions of academic papers, websites, and publications worldwide",
    },
    {
      icon: Bot,
      title: "AI Content Detection",
      description: "Identify AI-generated text from ChatGPT, Claude, and other AI tools",
    },
    {
      icon: Clock,
      title: "Fast Processing",
      description: "Get your detailed reports back within minutes, not hours",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your documents are encrypted and never shared with third parties",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Create Account",
      description: "Sign up with your email, phone, and password",
    },
    {
      number: "2",
      title: "Purchase Credits",
      description: "Contact us on WhatsApp to buy credits",
    },
    {
      number: "3",
      title: "Upload Document",
      description: "Upload your file (1 credit per document)",
    },
    {
      number: "4",
      title: "Get Reports",
      description: "Download similarity and AI detection reports",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">PlagaiScans</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium hidden sm:block">
                Pricing
              </a>
              {user ? (
                <Link to="/dashboard">
                  <Button className="bg-blue-700 hover:bg-blue-800 text-white rounded-full px-6">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-gray-600 hover:text-gray-900 font-medium">
                    Login
                  </Link>
                  <Link to="/auth">
                    <Button className="bg-blue-700 hover:bg-blue-800 text-white rounded-full px-6">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-200 mb-8">
            <Sparkles className="w-4 h-4 text-blue-700" />
            <span className="text-sm text-gray-600">Trusted by 10,000+ academics & researchers</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
            Detect Plagiarism & AI Content
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              With Confidence
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            Professional document analysis service for students, educators, and businesses. 
            Get detailed similarity and AI detection reports in minutes.
          </p>

          {/* Features List */}
          <div className="inline-flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Advanced Similarity Detection</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>AI Content Analysis</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Detailed PDF Reports</span>
            </div>
          </div>

          {/* CTA Button */}
          <div>
            <Link to="/auth">
              <Button className="bg-blue-700 hover:bg-blue-800 text-white rounded-full px-8 py-6 text-lg font-medium">
                Start Checking
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Comprehensive Document Analysis
            </h2>
            <p className="text-gray-500 text-lg">
              Our platform provides thorough checking to ensure document authenticity
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-gray-500 text-lg">
              Get your document checked in four simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-blue-700 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-gray-500 text-lg">
              Pay per document with no hidden fees. 1 credit = 1 document check
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Starter Package */}
            <Card className="relative border-2 border-gray-200 hover:border-blue-300 transition-colors">
              <CardHeader className="text-center pb-2">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-blue-700" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Starter</CardTitle>
                <p className="text-gray-500 text-sm">Perfect for single documents</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$2</span>
                  <span className="text-gray-500"> / 1 credit</span>
                </div>
                <ul className="space-y-3 text-sm text-gray-600 mb-6">
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>1 document check</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Similarity report</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>AI detection report</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>PDF downloadable reports</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button variant="outline" className="w-full rounded-full">
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Value Package */}
            <Card className="relative border-2 border-blue-500 shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  BEST VALUE
                </span>
              </div>
              <CardHeader className="text-center pb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-6 h-6 text-blue-700" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Value Pack</CardTitle>
                <p className="text-gray-500 text-sm">Best for multiple documents</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$10</span>
                  <span className="text-gray-500"> / 10 credits</span>
                  <div className="text-green-600 text-sm font-medium mt-1">Save $10!</div>
                </div>
                <ul className="space-y-3 text-sm text-gray-600 mb-6">
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>10 document checks</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Similarity reports</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>AI detection reports</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>PDF downloadable reports</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Priority processing</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button className="w-full bg-blue-700 hover:bg-blue-800 text-white rounded-full">
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-gray-500 text-sm mt-8">
            Need more credits? Contact us on WhatsApp for custom packages.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Check Your Documents?
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            Join thousands of users who trust PlagaiScans for accurate plagiarism and AI detection.
          </p>
          <Link to="/auth">
            <Button className="bg-blue-700 hover:bg-blue-800 text-white rounded-full px-8 py-6 text-lg font-medium">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
        </section>
      </main>

      <Footer />

      <WhatsAppSupportButton />
    </div>
  );
};

export default Landing;
