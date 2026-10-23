import ForBusinessesLandingPage from "./ForBusinessesLandingPage";
import { getMarketplaceCounts } from "../../utils/marketing/marketplaceCounts";

export default async function ForBusinessesPage() {
  return <ForBusinessesLandingPage stats={await getMarketplaceCounts()} />;
}
