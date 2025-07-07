
"use client"

import React from 'react'
import Link from 'next/link'
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from '@/hooks/use-auth'
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Trash2, ArrowLeft, Loader2 } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

const dialogueSecuriteSchema = z.object({
  date: z.date({ required_error: "La date est requise." }),
  observateur: z.string().min(1, "L'observateur est requis."),
  activite: z.string().min(1, "L'activité est requise."),
  zone: z.string().min(1, "La zone est requise."),
  poste: z.string().min(1, "Le poste est requis."),
  nombrePersonnes: z.coerce.number().min(1, "Le nombre de personnes est requis."),
  identification: z.string().min(1, "L'identification est requise."),
  comportementsPositifs: z.array(z.object({ value: z.string().min(1, "Ce champ est requis.") })).max(5),
  anomalies: z.array(z.object({
    type: z.enum(["AD", "IS", "SD"], { required_error: "Le type est requis." }),
    description: z.string().min(1, "La description est requise."),
    familleRisque: z.string().min(1, "La famille de risque est requise."),
    actionsImmediates: z.string().optional(),
    actionsCorrectives: z.string().optional(),
    echeance: z.date().optional(),
    garant: z.string().optional(),
    responsable: z.string().optional(),
    statut: z.enum(["En cours", "Réalisée", "Non réalisée"], { required_error: "Le statut est requis." }),
  })),
  commentaires: z.string().optional(),
})

type DialogueSecuriteFormValues = z.infer<typeof dialogueSecuriteSchema>

const famillesDeRisque = ["Chute de plain-pied", "Heurt", "Risque chimique", "Risque électrique", "Manutention manuelle", "Autre"];

export default function NewDialogueSecuritePage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<DialogueSecuriteFormValues>({
    resolver: zodResolver(dialogueSecuriteSchema),
    defaultValues: {
      observateur: user?.displayName || user?.email || '',
      date: new Date(),
      comportementsPositifs: [{ value: "" }],
      anomalies: [],
    },
  })

  const { fields: comportementsFields, append: appendComportement, remove: removeComportement } = useFieldArray({
    name: "comportementsPositifs",
    control: form.control,
  })

  const { fields: anomaliesFields, append: appendAnomalie, remove: removeAnomalie } = useFieldArray({
    name: "anomalies",
    control: form.control,
  })

  async function onSubmit(data: DialogueSecuriteFormValues) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Erreur d'authentification",
            description: "Vous devez être connecté pour soumettre un formulaire.",
        })
        return
    }
    setIsSubmitting(true)
    try {
      await addDoc(collection(db, "dialoguesSecurite"), {
        ...data,
        createdBy: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        status: "En attente de validation",
      });
      toast({
        title: "Formulaire Soumis",
        description: "Le dialogue de sécurité a été envoyé pour validation.",
      })
      router.push('/dashboard/audits')
    } catch (error) {
      console.error("Error adding document: ", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer le formulaire. Veuillez réessayer.",
      })
    } finally {
        setIsSubmitting(false)
    }
  }

  async function onSaveDraft() {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Erreur d'authentification",
            description: "Vous devez être connecté pour enregistrer un brouillon.",
        })
        return
    }
    setIsSubmitting(true);
    const data = form.getValues();
    try {
      await addDoc(collection(db, "dialoguesSecurite"), {
        ...data,
        status: "Brouillon",
        createdBy: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
      });
      toast({
        title: "Brouillon Enregistré",
        description: "Le dialogue de sécurité a été sauvegardé en tant que brouillon.",
      })
      router.push('/dashboard/audits');
    } catch (error) {
      console.error("Error saving draft: ", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer le brouillon. Veuillez réessayer.",
      })
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/audits"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Nouveau Dialogue Sécurité / حوار أمن جديد</h1>
            <p className="text-muted-foreground">
            Remplissez les informations ci-dessous pour créer un nouveau dialogue sécurité.
            </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Informations Générales</CardTitle>
              <CardDescription>Détails sur le contexte du dialogue.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date du dialogue</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Choisir une date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="observateur" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observateur</FormLabel>
                    <FormControl><Input {...field} readOnly /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="activite" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activité observée</FormLabel>
                    <FormControl><Input placeholder="Ex: Maintenance préventive" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="zone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zone / Unité</FormLabel>
                    <FormControl><Input placeholder="Ex: Atelier de production" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="poste" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poste de travail</FormLabel>
                    <FormControl><Input placeholder="Ex: Opérateur machine" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="nombrePersonnes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de personnes</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="identification" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identification (Nom ou matricule)</FormLabel>
                    <FormControl><Input placeholder="Nom ou matricule de la personne observée" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Comportements Positifs Observés</CardTitle>
                <CardDescription>Listez les bonnes pratiques de sécurité constatées.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {comportementsFields.map((field, index) => (
                    <FormField
                    key={field.id}
                    control={form.control}
                    name={`comportementsPositifs.${index}.value`}
                    render={({ field }) => (
                        <FormItem>
                        <div className="flex items-center gap-2">
                            <FormControl>
                                <Input {...field} placeholder={`Bonne pratique n°${index + 1}`} />
                            </FormControl>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeComportement(index)} disabled={comportementsFields.length <= 1}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendComportement({ value: "" })} disabled={comportementsFields.length >= 5}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter un comportement
                </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anomalies Constatées</CardTitle>
              <CardDescription>Saisissez les écarts par rapport aux règles de sécurité.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {anomaliesFields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                        <h4 className="font-semibold">Anomalie n°{index + 1}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField control={form.control} name={`anomalies.${index}.type`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type d'anomalie</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="AD">Acte Dangereux (AD)</SelectItem>
                                        <SelectItem value="IS">Situation Dangereuse (IS)</SelectItem>
                                        <SelectItem value="SD">Système Défaillant (SD)</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`anomalies.${index}.familleRisque`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Famille de risque</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {famillesDeRisque.map(famille => <SelectItem key={famille} value={famille}>{famille}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <FormField control={form.control} name={`anomalies.${index}.description`} render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description de l'anomalie</FormLabel>
                                <FormControl><Textarea placeholder="Décrivez précisément l'anomalie..." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name={`anomalies.${index}.actionsImmediates`} render={({ field }) => (
                            <FormItem>
                                <FormLabel>Actions immédiates</FormLabel>
                                <FormControl><Textarea placeholder="Quelles actions ont été prises sur le champ ?" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <h5 className="font-medium pt-2">Plan d'action correctif</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField control={form.control} name={`anomalies.${index}.responsable`} render={({ field }) => (
                                <FormItem><FormLabel>Responsable</FormLabel><FormControl><Input placeholder="Nom du responsable" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name={`anomalies.${index}.garant`} render={({ field }) => (
                                <FormItem><FormLabel>Garant</FormLabel><FormControl><Input placeholder="Nom du garant" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`anomalies.${index}.echeance`} render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Échéance</FormLabel>
                                <Popover><PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP") : <span>Choisir une date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                </PopoverContent></Popover><FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`anomalies.${index}.statut`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Statut</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="En cours">En cours</SelectItem>
                                        <SelectItem value="Réalisée">Réalisée</SelectItem>
                                        <SelectItem value="Non réalisée">Non réalisée</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => removeAnomalie(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendAnomalie({ type: 'AD', description: '', familleRisque: '', statut: 'En cours', actionsImmediates: '', actionsCorrectives: '', responsable: '', garant: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter une anomalie
                </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commentaires & Recommandations</CardTitle>
            </CardHeader>
            <CardContent>
                <FormField control={form.control} name="commentaires" render={({ field }) => (
                    <FormItem>
                        <FormControl><Textarea placeholder="Ajoutez des commentaires ou recommandations générales..." rows={4} {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer le brouillon
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Soumettre pour validation
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
