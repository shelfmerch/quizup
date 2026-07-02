import { useLocation } from "react-router-dom";
import SEO from "@/components/SEO";
import {
  DEFAULT_APP_SEO,
  ROUTE_SEO,
  hashCanonicalUrl,
  type SEOConfig,
} from "@/config/seo";

function resolveRouteSEO(pathname: string): SEOConfig {
  if (ROUTE_SEO[pathname]) return ROUTE_SEO[pathname];
  return DEFAULT_APP_SEO;
}

const RouteSEO: React.FC = () => {
  const { pathname } = useLocation();
  const config = resolveRouteSEO(pathname);

  return (
    <SEO
      title={config.title}
      description={config.description}
      image={config.image}
      url={hashCanonicalUrl(pathname)}
      type={config.type}
      noindex={config.noindex}
      jsonLd={config.jsonLd}
    />
  );
};

export default RouteSEO;
