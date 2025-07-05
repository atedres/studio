"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { User, Bell, Lock, Users, Loader2 } from "lucide-react"

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères."),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les nouveaux mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, updateUserProfile, updateUserPassword } = useAuth()
  const { toast } = useToast()

  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    }
  });

  useEffect(() => {
    if (user) {
        setDisplayName(user.displayName || "")
        setEmail(user.email || "")
    }
  }, [user])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
        toast({
            variant: "destructive",
            title: "Nom Invalide",
            description: "Le nom ne peut pas être vide.",
        })
        return;
    }
    
    setIsUpdatingProfile(true)
    try {
        if (updateUserProfile) {
          await updateUserProfile({ displayName })
          toast({
              title: "Profil Mis à Jour",
              description: "Votre nom a été mis à jour avec succès.",
          })
        }
    } catch (error) {
        console.error(error)
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible de mettre à jour le profil.",
        })
    } finally {
        setIsUpdatingProfile(false)
    }
  }

  const handlePasswordUpdate = async (values: PasswordFormValues) => {
    if (!updateUserPassword) return;

    try {
        await updateUserPassword(values.currentPassword, values.newPassword);
        toast({
            title: "Succès",
            description: "Votre mot de passe a été changé avec succès.",
        });
        passwordForm.reset();
        setIsPasswordDialogOpen(false);
    } catch (error: any) {
        console.error("Password change error:", error);
        let description = "Une erreur est survenue.";
        if (error.code === 'auth/wrong-password') {
            description = "Le mot de passe actuel est incorrect.";
            passwordForm.setError("currentPassword", { type: "manual", message: "Mot de passe incorrect." });
        }
        toast({
            variant: "destructive",
            title: "Erreur de changement de mot de passe",
            description,
        });
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Paramètres / الإعدادات</h1>
        <p className="text-muted-foreground">
          Gérez les paramètres du compte, les accès et les notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Gestion des Droits d'Accès</CardTitle>
                    <CardDescription>Définissez les permissions pour chaque rôle utilisateur.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <p className="font-medium">Opérateur</p>
                            <p className="text-sm text-muted-foreground">Peut saisir des remontées terrain.</p>
                        </div>
                        <Button variant="outline">Gérer</Button>
                    </div>
                     <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <p className="font-medium">Manager</p>
                            <p className="text-sm text-muted-foreground">Valide les plans d'actions.</p>
                        </div>
                        <Button variant="outline">Gérer</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <p className="font-medium">Admin HSE</p>
                            <p className="text-sm text-muted-foreground">Accès complet aux modules HSE.</p>
                        </div>
                        <Button variant="outline">Gérer</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <p className="font-medium">Direction</p>
                            <p className="text-sm text-muted-foreground">Visualise les tableaux de bord globaux.</p>
                        </div>
                        <Button variant="outline">Gérer</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
                    <CardDescription>Configurez les notifications par email.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notif-deadline">Échéance d'action proche</Label>
                        <Switch id="notif-deadline" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notif-validation">Action non validée après 48h</Label>
                        <Switch id="notif-validation" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notif-report">Rapport hebdomadaire</Label>
                        <Switch id="notif-report" />
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Sécurité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                        <DialogTrigger asChild>
                             <Button variant="outline" className="w-full">Changer le mot de passe</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Changer le mot de passe</DialogTitle>
                                <DialogDescription>
                                    Entrez votre mot de passe actuel et votre nouveau mot de passe.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...passwordForm}>
                                <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
                                     <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Mot de passe actuel</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={passwordForm.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nouveau mot de passe</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={passwordForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                            {passwordForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enregistrer
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" className="w-full">Activer l'authentification à deux facteurs</Button>
                    <p className="text-xs text-muted-foreground text-center pt-2">Dernière modification de mot de passe: il y a 3 mois.</p>
                </CardContent>
             </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Mon Profil</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div>
                          <Label htmlFor="name">Nom</Label>
                          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                      </div>
                       <div>
                          <Label htmlFor="email-settings">Email</Label>
                          <Input id="email-settings" type="email" value={email} readOnly disabled />
                      </div>
                      <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isUpdatingProfile}>
                          {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Mettre à jour le profil
                      </Button>
                  </form>
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  )
}
