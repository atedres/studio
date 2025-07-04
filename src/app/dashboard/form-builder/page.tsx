"use client"
import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wand2, Loader2, ClipboardCheck, ArrowRight } from "lucide-react"
import { Separator } from '@/components/ui/separator'

export default function FormBuilderPage() {
  const [topic, setTopic] = useState("Audit de sécurité pour travaux en hauteur")
  const [isGenerating, setIsGenerating] = useState(false)
  const [formGenerated, setFormGenerated] = useState(false)

  const handleGenerateForm = () => {
    if (!topic) return
    setIsGenerating(true)
    setFormGenerated(false)
    setTimeout(() => {
      setIsGenerating(false)
      setFormGenerated(true)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Générateur de Formulaires (IA) / منشئ النماذج (AI)</h1>
        <p className="text-muted-foreground">
          Créez dynamiquement des formulaires d'audit et de dialogue sécurité grâce à l'IA.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wand2 className="text-accent"/> 1. Définir le Sujet</CardTitle>
                    <CardDescription>Décrivez le type de formulaire HSE que vous souhaitez créer. L'IA proposera les champs pertinents.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="hse-topic">Sujet HSE / موضوع HSE</Label>
                        <Textarea 
                            id="hse-topic"
                            placeholder="Ex: Audit 5S, Dialogue sécurité chariot élévateur..." 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            rows={4}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleGenerateForm} disabled={isGenerating || !topic} className="w-full bg-accent hover:bg-accent/90">
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                        )}
                        {isGenerating ? "Génération en cours..." : "Générer le formulaire"}
                    </Button>
                </CardFooter>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <Card className="min-h-[500px]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ClipboardCheck className="text-primary"/> 2. Prévisualisation du Formulaire</CardTitle>
                    <CardDescription>Voici un aperçu du formulaire généré. Vous pourrez le personnaliser ensuite.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isGenerating && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <p>Analyse du sujet et construction des champs...</p>
                        </div>
                    )}
                    {formGenerated && (
                        <fieldset disabled className="space-y-6 animate-in fade-in-50">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date de l'audit</Label>
                                    <Input type="date" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Auditeur</Label>
                                    <Input placeholder="Nom de l'auditeur" />
                                </div>
                             </div>
                             <Separator />
                             <h3 className="font-semibold text-lg">Vérification des Équipements de Protection Individuelle (EPI)</h3>
                             <div className="space-y-2">
                                <Label>État du harnais de sécurité</Label>
                                <Select>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner un état" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="conforme">Conforme</SelectItem>
                                        <SelectItem value="non-conforme">Non conforme</SelectItem>
                                        <SelectItem value="na">Non applicable</SelectItem>
                                    </SelectContent>
                                </Select>
                             </div>
                             <div className="space-y-2">
                                <Label>Présence de la ligne de vie</Label>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="line-presence" />
                                    <label htmlFor="line-presence">Ligne de vie installée et vérifiée</label>
                                </div>
                             </div>
                             <Separator />
                             <h3 className="font-semibold text-lg">Conditions de Travail</h3>
                             <div className="space-y-2">
                                <Label>Observations générales</Label>
                                <Textarea placeholder="Décrire les conditions, points positifs et négatifs..." rows={3} />
                             </div>
                              <div className="space-y-2">
                                <Label>Pièces jointes</Label>
                                <Input type="file" />
                                <p className="text-xs text-muted-foreground">Ajoutez des photos des anomalies ou des bonnes pratiques.</p>
                             </div>
                             <Button type="submit" className="bg-primary hover:bg-primary/90">Soumettre le formulaire</Button>
                        </fieldset>
                    )}
                     {!isGenerating && !formGenerated && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <p>Le formulaire généré par l'IA apparaîtra ici.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  )
}
