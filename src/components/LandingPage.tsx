import Link from 'next/link'
import { ArrowRight, BarChart2, Database, Shield, Zap, Check, X } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-brand-primary/5 to-white pt-20 pb-32 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl mb-6">
              <span className="block">Unlock Insights from</span>
              <span className="block text-brand-primary">Your Genomic Data</span>
            </h1>
            <p className="mt-4 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              GenoLens Next provides a powerful, intuitive platform for visualizing, analyzing, and managing complex genomic datasets. From QC to differential expression, see your data clearly.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link
                href="/login"
                className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary/90 md:py-4 md:text-lg md:px-10 shadow-lg hover:shadow-xl transition-all"
              >
                Get Started
              </Link>
              <Link
                href="#features"
                className="px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-0 opacity-30">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-secondary blur-3xl mix-blend-multiply animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-accent blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-96 h-96 rounded-full bg-brand-primary blur-3xl mix-blend-multiply animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base text-brand-secondary font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need for genomic analysis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<BarChart2 className="h-8 w-8 text-white" />}
              title="Interactive Visualization"
              description="Explore PCA plots, heatmaps, and volcano plots with fully interactive tools."
            />
            <FeatureCard 
              icon={<Database className="h-8 w-8 text-white" />}
              title="Data Management"
              description="Organize projects and datasets efficiently with our robust management system."
            />
            <FeatureCard 
              icon={<Zap className="h-8 w-8 text-white" />}
              title="Fast Processing"
              description="Leverage optimized pipelines for quick data processing and analysis."
            />
            <FeatureCard 
              icon={<Shield className="h-8 w-8 text-white" />}
              title="Secure & Private"
              description="Your data is protected with enterprise-grade security and access controls."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base text-brand-secondary font-semibold tracking-wide uppercase">Pricing</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Choose the perfect plan for your research
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* BASIC */}
            <PricingCard
              name="Basic"
              price="Free"
              description="Essential tools for small projects and individual researchers."
              features={[
                "Access your projects",
                "Visualize comparisons",
                "Share with team",
                "Volcano plots, heatmaps",
                "Gene expression queries",
                "Basic enrichment analysis"
              ]}
              limitations={[
                 "No AI interpretation",
                 "Cannot launch analyses"
              ]}
              cta="Get Started"
              ctaLink="/login?plan=basic"
            />
            
            {/* PREMIUM */}
            <PricingCard
              name="Premium"
              price="$29"
              period="/month"
              popular
              description="Advanced AI features to accelerate your biological interpretation."
              features={[
                "Everything in Basic",
                "AI interpretation (15 free/month)",
                "AI Q&A assistant",
                "Advanced visualizations",
                "Pathway enrichment",
                "Priority support"
              ]}
              limitations={[
                "Additional interpretations: $2/each",
                "Cannot launch analyses"
              ]}
              cta="Start Free Trial"
              ctaLink="/login?plan=premium"
            />
            
            {/* ADVANCED */}
            <PricingCard
              name="Advanced"
              price="Coming Soon"
              description="Complete platform for labs requiring full analysis pipelines."
              features={[
                "Everything in Premium",
                "Launch DESeq2 analyses",
                "Unlimited AI interpretations",
                "Priority processing queue",
                "Batch analysis upload",
                "Custom workflows",
                "Dedicated support"
              ]}
              cta="Request Early Access"
              ctaLink="mailto:support@genolens.io"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-brand-primary py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Ready to dive into your data?
          </h2>
          <p className="mt-4 text-lg text-brand-secondary/80">
            Join researchers worldwide using GenoLens Next.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-brand-primary bg-white hover:bg-gray-50"
            >
              Create an Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description?: string;
  popular?: boolean;
  features: string[];
  limitations?: string[];
  cta: string;
  ctaLink: string;
}

function PricingCard({ name, price, period, description, popular, features, limitations, cta, ctaLink }: PricingCardProps) {
  return (
    <div className={`flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden ${popular ? 'ring-2 ring-brand-primary scale-105 z-10' : ''}`}>
      {popular && (
        <div className="bg-brand-primary text-white text-xs font-bold uppercase tracking-wide text-center py-1">
          Most Popular
        </div>
      )}
      <div className="p-8 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold leading-8 text-gray-900">{name}</h3>
        {description && <p className="mt-4 text-sm leading-6 text-gray-500">{description}</p>}
        <p className="mt-6 flex items-baseline gap-x-1">
          <span className="text-4xl font-bold tracking-tight text-gray-900">{price}</span>
          {period && <span className="text-sm font-semibold leading-6 text-gray-600">{period}</span>}
        </p>
        
        <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600 flex-1">
          {features.map((feature) => (
            <li key={feature} className="flex gap-x-3">
              <Check className="h-6 w-5 flex-none text-brand-primary" aria-hidden="true" />
              {feature}
            </li>
          ))}
          {limitations?.map((limitation) => (
             <li key={limitation} className="flex gap-x-3 text-gray-400">
              <X className="h-6 w-5 flex-none text-gray-400" aria-hidden="true" />
              {limitation}
            </li>
          ))}
        </ul>
        
        <Link
          href={ctaLink}
          className={`mt-8 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            popular
              ? 'bg-brand-primary text-white hover:bg-brand-primary/90 focus-visible:outline-brand-primary shadow-sm'
              : 'text-brand-primary ring-1 ring-inset ring-brand-primary/20 hover:ring-brand-primary/30'
          }`}
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="h-12 w-12 rounded-lg bg-brand-primary flex items-center justify-center mb-4 shadow-lg">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500">{description}</p>
    </div>
  )
}
