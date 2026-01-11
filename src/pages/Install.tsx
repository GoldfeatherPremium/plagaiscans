import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, Smartphone, CheckCircle, Share, PlusSquare, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Install = () => {
  const { t } = useTranslation('pages');
  const { isInstallable, isInstalled, promptInstall, isIOS, isAndroid } = usePWAInstall();
  const navigate = useNavigate();

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      navigate('/dashboard');
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('install.installed')}</CardTitle>
            <CardDescription>
              {t('install.installedDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              {t('install.goToDashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('install.title')}</CardTitle>
          <CardDescription>
            {t('install.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstallable && (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              {t('install.installButton')}
            </Button>
          )}

          {isIOS && !isInstallable && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {t('install.iosInstructions')}
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">1</span>
                  <span className="flex items-center gap-2">
                    {t('install.iosStep1')} <Share className="w-4 h-4 inline text-primary" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">2</span>
                  <span className="flex items-center gap-2">
                    {t('install.iosStep2')} <PlusSquare className="w-4 h-4 inline text-primary" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">3</span>
                  <span>{t('install.iosStep3')}</span>
                </li>
              </ol>
            </div>
          )}

          {isAndroid && !isInstallable && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {t('install.androidInstructions')}
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">1</span>
                  <span className="flex items-center gap-2">
                    {t('install.androidStep1')} <MoreVertical className="w-4 h-4 inline text-primary" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">2</span>
                  <span>{t('install.androidStep2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">3</span>
                  <span>{t('install.androidStep3')}</span>
                </li>
              </ol>
            </div>
          )}

          {!isIOS && !isAndroid && !isInstallable && (
            <p className="text-sm text-muted-foreground text-center">
              {t('install.fallbackMessage')}
            </p>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2 text-sm">{t('install.benefitsTitle')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                {t('install.benefit1')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                {t('install.benefit2')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                {t('install.benefit3')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                {t('install.benefit4')}
              </li>
            </ul>
          </div>

          <Button variant="outline" onClick={() => navigate('/')} className="w-full">
            {t('install.backToHome')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
