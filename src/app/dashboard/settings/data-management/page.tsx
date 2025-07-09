
"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import { DataManagementTable } from "@/components/data-management-table"

export default function DataManagementPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/settings"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Gestion des Données de Base</h1>
                    <p className="text-muted-foreground">
                        Gérez les listes utilisées dans les formulaires de l'application et leurs relations.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Données de Référence</CardTitle>
                    <CardDescription>
                        Ajoutez, modifiez ou désactivez les options et liez-les entre elles pour une saisie de formulaire cohérente.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="zones">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                            <TabsTrigger value="zones">Zones de Travail</TabsTrigger>
                            <TabsTrigger value="postes">Postes de Travail</TabsTrigger>
                            <TabsTrigger value="activites">Activités Observées</TabsTrigger>
                            <TabsTrigger value="risques">Familles de Risque</TabsTrigger>
                        </TabsList>
                        <TabsContent value="zones" className="mt-4">
                            <DataManagementTable
                                collectionName="zonesDeTravail"
                                title="Zones de Travail"
                                relations={[
                                    { collectionName: "postesDeTravail", label: "Postes de Travail Liés", fieldName: "postes" },
                                    { collectionName: "activitesObservees", label: "Activités Observées Liées", fieldName: "activites" }
                                ]}
                            />
                        </TabsContent>
                        <TabsContent value="postes" className="mt-4">
                             <DataManagementTable
                                collectionName="postesDeTravail"
                                title="Postes de Travail"
                            />
                        </TabsContent>
                        <TabsContent value="activites" className="mt-4">
                             <DataManagementTable
                                collectionName="activitesObservees"
                                title="Activités Observées"
                            />
                        </TabsContent>
                        <TabsContent value="risques" className="mt-4">
                             <DataManagementTable
                                collectionName="famillesDeRisque"
                                title="Familles de Risque"
                                relations={[
                                    { staticOptions: ["AD", "IS", "SD"], label: "Types d'Anomalie Liés", fieldName: "types" }
                                ]}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
