/** Curated moderation vocabulary, not a census or an ethnicity/gender classifier.
 * Sources, limitations and tuning guidance: docs/CIRKLES-NAME-CORPUS.md.
 * Keep common-word collisions in CONTEXT_NAMES rather than treating them as proof.
 */
const words = (s: string) => s.trim().toLowerCase().split(/\s+/);
export const BOTSWANA_GIVEN_NAMES = words(`
Katlego Kgosi Thabo Boitumelo Amantle Phenyo Tshepo Kefilwe Lesego Kagiso Oratile Gorata Kabelo Mpho Palesa Tebogo
Goitseone Larona Wame Warona Refilwe Bonolo Bontle Kitso Tumelo Bame Tlotlo Thato Lame Maatla Naledi Gomolemo
Onalenna Phatsimo Realeboga Letlhogonolo Loago Oabile Neo Kutlo Bakang Tumo Atang Gaone Segolame Boipelo Lorato
Tsholofelo Keabetswe Boikhutso Otsile Modiri Molebi Kabo Karabo Dintle Masego Lesedi Onalerona Reatlegile
Amogelang Amohelang Bokamoso Rethabile Omphile Onthatile Obakeng Ofentse Oarabile Olebile Olorato Omphemetse
Ontiretse Oageng Oaitse Odirile Onkgopotse Othusitse Oteng Otshepeng Otshegofaditswe Otshephile Oupa
Goitsemodimo Goitsekgosi Goitsemang Goitsemedime Gontse Gontle Gotlhe Gofaone Gosego Gomotsang Gomotsegang
Keaobaka Keamogetse Keamogetswe Keaipela Kealeboga Kealebogile Keitumetse Keletso Keorapetse Keoratile
Keotshepile Kelebogile Kgalalelo Kgakgamatso Kgomotso Kgothatso Khumo Khumoyame Kutlwano Lebogang Lebogile
Lefa Lefika Lethabo Lethokuhle Letso Leungo Loatile Loratong Lotlhe Masechaba Masedi Mmapula Mmabatho
Mmoniemang Modiegi Moagi Mogomotsi Mohau Mokolobetsi Mompati Mosadi Motheo Mothusi Motswedi Nametso
Nonofo Olebogeng Ontlametse Ontshepile Peo Phodiso Poloko Pono Pula Pulane Ratanang Ratang Reaoboka
Reabetswe Reagile Realotlegile Reamogetse Reamogetswe Reatile Refiloe Regomoditswe Rorisang Rraetsho
Segopotso Seitiso Selelo Thapelo Thebe Thuto Tiro Tlotlego Tshiamo Tshepang Tshepho Tshegofatso Tshegofaditswe
Tsholofelo Tshwanelo Tumiso Tumisang Tumi Tsitsi Unami Wabo Wedu Yaone Tshireletso Tlotlang Tshenolo
`);
export const REGIONAL_GIVEN_NAMES = words(`
Panashe Tanaka Tadiwa Tatenda Farai Ayanda Sipho Thandi Mandla Nkosazana Bongani Lerato Pule Kopano
Tendai Tinashe Takudzwa Tapiwa Tafadzwa Tawanda Tonderai Tashinga Ruvimbo Rufaro Rutendo Rudo Ropafadzo
Nyasha Nyarai Nokutenda Nontokozo Nothando Nomsa Nomvula Noma Nokuthula Nomathemba Nomalanga Nompilo
Sibusiso Siyabonga Siphiwe Sizwe Sandile Sanele Sifiso Sihle Simphiwe Sinazo Sinothando Siphesihle
Thandeka Thandile Thando Thandolwethu Thembeka Themba Thembelihle Thulani Thuli Thulisile Thabisa
Lindiwe Lindokuhle Lwandle Lunga Lungelo Lungile Luthando Lubanzi Lusanda Lulama Luyanda Luyolo
Mandla Mandisa Mandlenkosi Mncedisi Mthokozisi Mxolisi Mzamo Mzwandile Muzi Vusi Vuyani Vuyelwa
Zanele Zandile Zodwa Zoleka Zukiswa Zandisile Zibusiso Zenande Zinhle Zethu Zodwa Zodwa Zanele
Melokuhle Enzokuhle Amahle Okuhle Iminathi Nkanyezi Nkazimulo Banele Bandile Ayabonga Zanokuhle Lisakhanya
Nqobile Ntando Nokwanda Noxolo Nonhlanhla Nelisiwe Nosipho Nosihle Nondumiso Sithembiso Sakhile Sabelo
Siyanda Sinethemba Samkelo Simamkele Sibongile Sibongiseni Busisiwe Buyisiwe Bhekizizwe Bheki Bhekisisa
Dumisani Dumisile Dumi Dineo Dipuo Fikile Fezile Funeka Funani Hlengiwe Hlompho Itumeleng Jabulani Jabu
Khanyisile Khanyisa Khanya Khulekani Kudzai Kudakwashe Kumbirai Kundai Kudzanai Kuzivakwashe Kuziva
Kuda Chipo Chiedza Chenai Chenesai Chengetai Chikomborero Chikondi Chisomo Chuma Chux Charity
Fadzai Fadziso Fungai Fungisai Garikai Munashe Munesu Munyaradzi Mufaro Muchaneta Mucha Nyengeterai
Natsai Netsai Paidamoyo Ratidzo Rumbidzai Ruvarashe Shingai Shingirai Simbarashe Simba Tafara Tino Tinotenda
Tapiwanashe Tendekai Tendayi Tinaye Tsitsi Vimbai Wadzanai Zvikomborero Zvidzai Kudakwashe Tendai
Sibongani Sithembile Sindiso Siphosenkosi Nkosinathi Nkosi Nkululeko Ntombizodwa Ntombifuthi Ntombi
Velaphi Velenkosini Xolani Xoliswa Zwelakhe Zweli Zwakele Themba Khumbulani Mkhululi Thamsanqa
`);
export const REGIONAL_SURNAMES = words(`
Modise Molefe Motsumi Sebego Phiri Dube Ndlovu Moyo Mokgweetsi Moeng Sechele Khama Masisi Banda Ncube Sibanda
Mokoena Kgomo Ramotswe Marumo Tau Molebatsi Seretse Moroka Mogae Masire Khama Khama Motsepe Dlamini Nkosi
Khumalo Sithole Mkhize Gumede Mthembu Mahlangu Baloyi Maluleke Chauke Mabunda Shabalala Zulu Buthelezi
Cele Mbatha Mncube Mthethwa Mnguni Ngcobo Mdluli Ngema Shezi Hlongwane Mabuza Maseko Makhanya Mavundla
Mahlalela Nkambule Vilakazi Mhlongo Madonsela Nene Mtshali Mkhwanazi Ntuli Sibiya Sibisi Mpanza Mazibuko
Molepolole Morupisi Matambo Molale Saleshando Boko Gobotswang Gaolathe Keorapetse Tsogwane Kgafela
Kgathi Nasha Skelemani Merafhe Kedikilwe Seretse Mogwe Makgato Mokaila Masisi Moatlhodi Moswaane
Mmegi Mmolotsi Motshegwa Rakgare Mmusi Letsholathebe Butale Reatile Ralekgetho Ralotsia Motsumi
Mmualefe Mogapi Moleboge Mothibi Motsamai Motlhagodi Mothusi Mogomotsi Motsumi Sebina Selelo Sekgoma
Sekgoma Mokgosi Moremi Matlapeng Matlho Monyatsi Motlogelwa Mothowa Moalosi Morapedi Morake Mosenogi
Ramosweu Ramokgopa Ramaphosa Ramoroka Ramokoka Ramogale Ranaka Rapoo Rasebotsa Rasekgo Rasesa
Seboni Sedimo Seleka Seleke Sello Sefako Seipone Setlhare Setshwaelo Tiro Tlhagale Tlhomelang Tsholetsa
Tshukudu Tshwene Tsheko Tsheole Tshekiso Tsietsi Tsima Motseosi Mongale Montsho Makwala Mogorosi
Ndou Nemavhola Netshitenzhe Mulaudzi Mudau Tshabalala Mashaba Shilubana Maposa Chirwa Tembo Mwanza
Mbewe Zulu Chanda Musonda Mwansa Mulenga Mwale Sakala Chileshe Nyirenda Nkhoma Mumba Chisanga
Mugabe Mnangagwa Tsvangirai Chamisa Mutasa Mutare Chigumba Chiwenga Chiweshe Chikowore Chikwanha
Chinoda Chinyama Chirwa Chitanga Chitate Choto Gondo Gumbo Gwaze Hove Hungwe Jere Kangai Karuru
Mapfumo Maponga Marufu Masuku Mathe Matibiri Matsika Mazarura Mazibuko Mbatha Mhlanga Mpofu Muchenje
Mugavazi Mukamuri Mukandi Mukanya Mupfumi Murewa Murwira Musarurwa Mushonga Mutizwa Muzenda Nkomo
Nzenza Nyathi Shoko Sibanda Siziba Tlou Tshuma Zwane Msimanga Motloung Mofokeng Mohlala Mohlomi
Moshoeshoe Moshesh Moloi Molapo Motaung Mafela Matabane Malema Madiba Mandela Tutu Nzimande Sefularo
`);
export const ENGLISH_GIVEN_NAMES = words(`
Aaron Abel Abigail Abraham Adam Adrian Agnes Albert Alex Alexander Alexandra Alfred Alice Alicia Alison
Amanda Amelia Amos Amy Andrew Angela Anita Ann Anna Anne Anthony Arthur Ashley Audrey Austin Barbara
Beatrice Benjamin Bernard Betty Beverly Brian Bridget Bruce Bryan Calvin Cameron Carl Caroline Catherine
Cecil Charles Charlotte Cheryl Chris Christian Christina Christopher Claire Clara Clarence Claude Clifford
Clive Colin Collins Cynthia Cyril Daniel David Deborah Debra Dennis Derek Desmond Diana Diane Dominic
Donald Doris Dorothy Douglas Duncan Edgar Edith Edmund Edward Edwin Elaine Eleanor Elizabeth Ellen
Elsie Emily Emmanuel Eric Ernest Esther Eugene Eunice Evelyn Ezra Felix Florence Frances Francis Frank
Frederick Gabriel Gareth Gavin Geoffrey George Gerald Gertrude Gilbert Gladys Gloria Gordon Graham Gregory
Hannah Harold Harriet Harry Hazel Helen Henry Herbert Herman Hilary Howard Hugh Ian Irene Isaac Isaiah
Jack Jacob Jacqueline James Janet Janice Jason Jean Jeffrey Jennifer Jeremiah Jeremy Jesse Jessica Joan
Joanna Joel John Jonathan Jordan Joseph Josephine Joshua Judith Julia Julian Julie Justin Karen Katherine
Kathleen Keith Kenneth Kevin Kimberly Kirsten Kyle Laura Lauren Lawrence Leah Leonard Leroy Leslie
Lewis Lillian Linda Lindsay Lisa Lloyd Lorraine Louis Louise Lucas Lucy Luke Lydia Malcolm Margaret
Maria Marian Marie Marilyn Marion Martha Martin Mary Matthew Maureen Maurice Maxwell Megan Michael
Michelle Mildred Miriam Monica Morgan Morris Moses Nathan Nathaniel Nicholas Nicole Nigel Noah Norman
Oliver Olivia Oscar Owen Pamela Patricia Patrick Paul Pauline Percy Peter Philip Phillip Phyllis Rachel
Ralph Raymond Rebecca Reginald Renee Richard Robert Roger Ronald Rosemary Roy Ruby Russell Ruth Ryan
Sally Samantha Samuel Sandra Sarah Scott Sean Sebastian Sharon Sheila Shirley Simon Solomon Sonia Sophie
Stanley Stephen Steven Stuart Susan Suzanne Sylvia Sydney Terence Teresa Terry Theodore Thomas Timothy
Tobias Tony Trevor Trudy Vanessa Vera Veronica Victor Victoria Vincent Violet Virginia Vivian Walter
Warren Wayne Wendy Wesley William Winston Yvonne Zachariah Zachary Zoe Christopher Emmanuel Jonathan
`);
export const CAMPUS_NICKNAMES = words(`
Boitu Kefi Kags Tebs Tsheps Kat Mphza Gori Orai Refi Boni Pheny Thabs Les Pales Nale Boity Kaboza
Tsholo Kele Lebza Teboza Kgomz Thatoz Katt Kagi Tumi Tumiya Pana Taddy Taffy Fari Tino Vee Sbu Siya
Lebo Lethu Bongi Zandi Thando Sips Nkosi Mphoza Bobo Tee Kaykay Keke
`);
export const CONTEXT_NAMES = new Set(words(`
one gift hope faith joy peace grace king queen prince princess blessing precious patience mercy fortune star
love comfort happy lucky bright modest clever neo thato lorato mpho kitso lesego lame rose mark will grant
dean may june april summer amber jade bill rob art ray pat dawn melody harmony hunter mason grace charity
silence innocent junior precious beauty promise success knowledge freedom trust wisdom favour favor praise
angel destiny pleasure pretty goodwell goodluck goodness wonder freedom prosper prosperity patience
`));
export const NAME_CORPUS = Array.from(new Set([...BOTSWANA_GIVEN_NAMES,...REGIONAL_GIVEN_NAMES,...REGIONAL_SURNAMES,...ENGLISH_GIVEN_NAMES,...CAMPUS_NICKNAMES,...Array.from(CONTEXT_NAMES)]));
export const HIGH_CONFIDENCE_NAMES = Array.from(new Set([...BOTSWANA_GIVEN_NAMES,...REGIONAL_GIVEN_NAMES,...REGIONAL_SURNAMES])).filter(n=>n.length>=5&&!CONTEXT_NAMES.has(n));
