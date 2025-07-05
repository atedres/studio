
"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { User, Bell, Lock, Users, Loader2 } from "lucide-react"

export default function SettingsPage() {
  const { user, updateUserProfile } = useAuth()
  const { toast } = useToast()

  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  
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
                    <Button variant="outline" className="w-full">Changer le mot de passe</Button>
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
