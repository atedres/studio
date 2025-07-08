
"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { logActivity } from '@/lib/activityLogger';


import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import { User, Bell, Lock, Users, Loader2, Database } from "lucide-react"

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères."),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les nouveaux mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

const profileSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom de famille est requis."),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const AccessRightsPlaceholder = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Gestion des Droits d'Accès</CardTitle>
        <CardDescription>Visualisez les permissions pour chaque rôle utilisateur.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Contactez votre administrateur pour modifier les rôles des utilisateurs.
        </p>
      </CardContent>
    </Card>
);

export default function SettingsPage() {
  const { user, updateUserProfile, updateUserPassword } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin';

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

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
    },
  });

  useEffect(() => {
    if (user) {
        profileForm.reset({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
        });
        setEmail(user.email || "")
    }
  }, [user, profileForm])

  const handleProfileUpdate = async (values: ProfileFormValues) => {
    setIsUpdatingProfile(true)
    try {
        if (updateUserProfile) {
          const displayName = `${values.firstName} ${values.lastName}`;
          await updateUserProfile({ displayName, ...values })
          await logActivity(user, "Mise à jour de son profil");
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
        await logActivity(user, "Modification de son mot de passe");
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
            {isAdmin ? (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Gestion des Utilisateurs</CardTitle>
                        <CardDescription>Ajoutez de nouveaux utilisateurs, modifiez leurs profils et attribuez des rôles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Gérez tous les comptes qui ont accès à la plateforme HSE.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild>
                            <Link href="/dashboard/settings/user-management">
                                Accéder à la gestion des utilisateurs
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            ) : <AccessRightsPlaceholder />}
            
            {isAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Database className="h-5 w-5" /> Gestion des Données
                        </CardTitle>
                        <CardDescription>
                          Ajoutez ou modifiez les entrées pour les listes déroulantes utilisées dans l'application (zones, postes, etc.).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Centralisez la gestion de vos données de référence pour assurer la cohérence des formulaires.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild>
                            <Link href="/dashboard/settings/data-management">
                                Accéder à la gestion des données
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            )}

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

        <div className="lg:col-span-1 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Mon Profil</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                                <FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} disabled={!isAdmin} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={profileForm.control} name="firstName" render={({ field }) => (
                                <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input {...field} disabled={!isAdmin} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                       <div>
                          <Label htmlFor="email-settings">Email</Label>
                          <Input id="email-settings" type="email" value={email} readOnly disabled />
                      </div>
                      {!isAdmin && (
                        <p className="text-xs text-muted-foreground pt-1">Seul un administrateur peut modifier le nom.</p>
                      )}
                      <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isUpdatingProfile || !isAdmin}>
                          {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Mettre à jour le profil
                      </Button>
                  </form>
                  </Form>
                </CardContent>
             </Card>

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
        </div>
      </div>
    </div>
  )
}
