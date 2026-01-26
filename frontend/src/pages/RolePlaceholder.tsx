import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RolePlaceholderProps {
  title: string;
  description: string;
}

const RolePlaceholder = ({ title, description }: RolePlaceholderProps) => {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="mt-2 text-muted-foreground">{description}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
            <CardDescription>
              This area is reserved for the next phase of role-specific tooling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We’ll connect this section to the new permissions model and data tables as they are wired up.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RolePlaceholder;
